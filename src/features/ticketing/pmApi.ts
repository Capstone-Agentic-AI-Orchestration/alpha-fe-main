import { ApiRequestError, apiService } from '@/shared/services/apiService';
import { parseClientDeliveryFile, parseClientDeliveryManifest, readPmDeliveryFile, type ClientDeliveryFile } from './clientDelivery';
import { parsePmDeliveryCandidates } from './pmDeliveryCandidates';

export type TicketStatus = 'received' | 'under_review' | 'awaiting_client' | 'in_progress'
  | 'ready_for_review' | 'on_hold' | 'closed' | 'declined' | 'cancelled';
export type TicketActionOwner = 'pm' | 'client' | 'developer' | null;
export type TicketNextAction = 'review_ticket' | 'reply' | 'agree_scope' | 'authorize_work' | 'execute_work'
  | 'assess_result' | 'share_result' | 'review_result' | 'close_ticket' | 'triage_correction'
  | 'handle_withdrawal' | 'resolve_hold' | null;

export interface PmTicketQueueItem {
  id: string;
  reference: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  readOnly: boolean;
  writesAvailable: boolean;
  requestedAction: 'reply' | 'agree_scope' | 'review_result' | null;
  internal: {
    updatedAt: string;
    actionOwner: TicketActionOwner;
    nextAction: TicketNextAction;
    projectId: string | null;
    clientAccessActive: boolean;
  };
}
export interface PmTicketQueuePage {
  items: PmTicketQueueItem[];
  nextCursor: string | null;
  counters: { kind: 'pm'; needsPm: number; inProgress: number; waitingClient: number; closedMonth: number };
}
export interface PmTicketMessage { id: string; author: 'pm' | 'client'; body: string; createdAt: string }
export interface PmTicketNote extends PmTicketMessage { authorId: string }
export interface PmTicketPage<T> { items: T[]; nextCursor: string | null }
export interface PmTicketReceipt {
  ticketId: string; operationId: string; version: number; status: TicketStatus;
  messageId?: string; reference?: string;
}

export interface PmTicketDetail {
  id: string;
  reference: string;
  title: string;
  description: string;
  companyLabel: string;
  status: TicketStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  readOnly: boolean;
  writesAvailable: boolean;
  requestedAction: 'reply' | 'agree_scope' | 'review_result' | null;
  sharedProjectName: string | null;
  relatedTicket: { id: string; reference: string; title: string } | null;
  scope: { id: string; summary: string; proposedAt: string; agreed: boolean } | null;
  delivery: { id: string; scopeVersionId: string; summary: string; sharedAt: string; accepted: boolean } | null;
  request: { projectPreference: 'not_sure' | 'new_project' | 'shared_project'; projectLabel: string | null; requestedDeadline: string | null } | null;
  internal: {
    updatedAt: string;
    projectId: string | null;
    requiredIssueIds: string[];
    actionOwner: TicketActionOwner;
    nextAction: TicketNextAction;
    authorizedScopeVersionId: string | null;
    correctionRequestedFor: string | null;
    withdrawalRequested: boolean;
    closureReason: 'accepted' | 'answered' | 'cancelled' | null;
    request: {
      source: 'authenticated_client' | 'public_inquiry';
      preferredProjectId: string | null;
      projectLabel: string | null;
      requestedDeadline: string | null;
      contact: { fullName: string; email: string; company: string | null; verification: 'unverified_submission' } | null;
    } | null;
    scopeVersion: { id: string; summary: string; developerBrief: string | null; proposedAt: string; immutable: boolean; clientVisible: boolean } | null;
    deliveryAssessment: {
      id: string; scopeVersionId: string; summary: string; pinnedAssetId: string; issueRevisionIds: string[];
      immutable: boolean; clientVisible: boolean; shared: boolean;
    } | null;
  };
}

export interface PmTicketQueueOptions {
  limit?: number;
  after?: string | null;
  search?: string;
  filter?: 'all' | 'history' | 'open' | 'needs_pm' | 'in_progress' | 'waiting_client' | 'closed_month';
}
export interface PmTicketMessageInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  body: string;
  action?: { type: 'reply' } | { type: 'request_details' } | { type: 'answer_close' };
}
export interface PmTicketNoteInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  body: string;
}
export type PmTicketCommand =
  | { type: 'review' }
  | { type: 'decline'; reason: string }
  | { type: 'request_details'; messageId: string }
  | { type: 'reply'; messageId: string }
  | { type: 'propose_scope'; scopeVersionId: string }
  | { type: 'authorize_work'; scopeVersionId: string; projectId: string; issueIds: string[] }
  | { type: 'assess_delivery'; deliveryId: string }
  | { type: 'share_delivery'; deliveryId: string }
  | { type: 'authorize_correction'; deliveryId: string; issueIds: string[]; reason: string }
  | { type: 'request_fixes'; issueIds: string[]; reason: string }
  | { type: 'close_accepted'; deliveryId: string }
  | { type: 'answer_close'; messageId: string }
  | { type: 'cancel'; reason: string }
  | { type: 'hold'; reason: string }
  | { type: 'resume' };
export interface PmTicketCommandInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  command: PmTicketCommand;
}
export interface PmTicketScopeProposalInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  publicSummary: string;
  developerBrief: string;
}
export interface PmTicketScopeProposalReceipt extends PmTicketReceipt {
  scopeVersionId: string;
}
export interface PmTicketInvitationReceipt {
  ticketId: string;
  invitationId: string;
  expiresAt: string;
  status: 'pending';
  alreadyPending: boolean;
}
export type PmTicketInvitationEmailReceipt = PmTicketInvitationReceipt;

function encodeId(value: string): string { return encodeURIComponent(value); }
function query(values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined) params.set(key, value);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

async function withOperationRecovery(
  submit: () => Promise<PmTicketReceipt>, lookup: () => Promise<PmTicketReceipt>,
): Promise<PmTicketReceipt> {
  try { return await submit(); }
  catch (error) {
    if (!(error instanceof ApiRequestError) || !error.reconciliationRequired) throw error;
    try { return await lookup(); }
    catch (lookupError) {
      if (!(lookupError instanceof ApiRequestError) || lookupError.status !== 404) throw lookupError;
    }
    // Retry exactly the same canonical payload and operation ID. The backend
    // serializes the operation key and returns its saved receipt if committed.
    return submit();
  }
}

/** Internal PM transport uses apiService's active workspace/session/desktop relay. */
export const pmTicketApi = {
  list(options: PmTicketQueueOptions = {}) {
    return apiService.ticketRequest<PmTicketQueuePage>(`/tickets${query({
      limit: options.limit === undefined ? undefined : String(options.limit),
      after: options.after, search: options.search, filter: options.filter,
    })}`);
  },
  get(ticketId: string) {
    return apiService.ticketRequest<PmTicketDetail>(`/tickets/${encodeId(ticketId)}`);
  },
  async getDelivery(ticketId: string, deliveryId: string, signal?: AbortSignal) {
    const value = await apiService.ticketRequest<unknown>(`/tickets/${encodeId(ticketId)}/deliveries/${encodeId(deliveryId)}`, { signal });
    return parseClientDeliveryManifest(value, deliveryId);
  },
  async getDeliveryCandidates(ticketId: string, after: string | null = null, signal?: AbortSignal) {
    return parsePmDeliveryCandidates(await apiService.ticketRequest<unknown>(
      `/tickets/${encodeId(ticketId)}/delivery-candidates${query({ limit: '10', after })}`, { signal },
    ));
  },
  async getDeliveryCandidate(ticketId: string, deliveryId: string, signal?: AbortSignal) {
    return parseClientDeliveryManifest(await apiService.ticketRequest<unknown>(
      `/tickets/${encodeId(ticketId)}/delivery-candidates/${encodeId(deliveryId)}`, { signal },
    ), deliveryId);
  },
  async getDeliveryCandidateFile(ticketId: string, deliveryId: string, input: ClientDeliveryFile, signal?: AbortSignal) {
    const file = parseClientDeliveryFile(input);
    return readPmDeliveryFile(await apiService.ticketRequest<unknown>(
      `/tickets/${encodeId(ticketId)}/delivery-candidates/${encodeId(deliveryId)}/files/${encodeId(file.id)}/content`, { signal },
    ), file);
  },
  async getDeliveryFile(ticketId: string, deliveryId: string, input: ClientDeliveryFile, signal?: AbortSignal) {
    const file = parseClientDeliveryFile(input);
    const value = await apiService.ticketRequest<unknown>(
      `/tickets/${encodeId(ticketId)}/deliveries/${encodeId(deliveryId)}/files/${encodeId(file.id)}/content`, { signal },
    );
    return readPmDeliveryFile(value, file);
  },
  getMessages(ticketId: string, options: { limit?: number; after?: string | null } = {}) {
    return apiService.ticketRequest<PmTicketPage<PmTicketMessage>>(
      `/tickets/${encodeId(ticketId)}/messages${query({ limit: options.limit === undefined ? undefined : String(options.limit), after: options.after })}`,
    );
  },
  getNotes(ticketId: string, options: { limit?: number; after?: string | null } = {}) {
    return apiService.ticketRequest<PmTicketPage<PmTicketNote>>(
      `/tickets/${encodeId(ticketId)}/notes${query({ limit: options.limit === undefined ? undefined : String(options.limit), after: options.after })}`,
    );
  },
  getOperation(ticketId: string, operationId: string) {
    return apiService.ticketRequest<PmTicketReceipt>(
      `/tickets/operations/${encodeId(operationId)}${query({ ticketId })}`,
    );
  },
  reply(ticketId: string, input: PmTicketMessageInput) {
    const path = `/tickets/${encodeId(ticketId)}/messages`;
    return withOperationRecovery(
      () => apiService.ticketRequest<PmTicketReceipt>(path, { method: 'POST', body: JSON.stringify(input) }),
      () => pmTicketApi.getOperation(ticketId, input.operationId),
    );
  },
  addNote(ticketId: string, input: PmTicketNoteInput) {
    const path = `/tickets/${encodeId(ticketId)}/notes`;
    return withOperationRecovery(
      () => apiService.ticketRequest<PmTicketReceipt>(path, { method: 'POST', body: JSON.stringify(input) }),
      () => pmTicketApi.getOperation(ticketId, input.operationId),
    );
  },
  execute(ticketId: string, input: PmTicketCommandInput) {
    const path = `/tickets/${encodeId(ticketId)}/commands`;
    return withOperationRecovery(
      () => apiService.ticketRequest<PmTicketReceipt>(path, { method: 'POST', body: JSON.stringify(input) }),
      () => pmTicketApi.getOperation(ticketId, input.operationId),
    );
  },
  proposeScope(ticketId: string, input: PmTicketScopeProposalInput) {
    // If the response is uncertain, the caller retries this identical payload
    // and operation ID; the server-side scope-operation index returns its receipt.
    return apiService.ticketRequest<PmTicketScopeProposalReceipt>(`/tickets/${encodeId(ticketId)}/scopes`, {
      method: 'POST', body: JSON.stringify(input),
    });
  },
  sendInvitationEmail(ticketId: string) {
    return apiService.ticketRequest<PmTicketInvitationReceipt>(
      `/tickets/${encodeId(ticketId)}/invitations`, { method: 'POST', body: '{}' },
    );
  },
};
