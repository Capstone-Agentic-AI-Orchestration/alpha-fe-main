import { ApiRequestError, apiService } from '@/shared/services/apiService';
import { parseConversation, parseConversationRequest, parseConversationRequests } from './projectConversation';
import { parseClientDeliveryFile, parseClientDeliveryManifest, readPmDeliveryFile, type ClientDeliveryFile } from './clientDelivery';
import { parsePmDeliveryCandidates } from './pmDeliveryCandidates';
import { parseTicketDocumentList, type TicketDocumentsReadApi } from './ticketDocuments';

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
    projectName?: string | null;
    clientAccessActive: boolean;
    clientGroup?: { key: string; displayName: string };
    clientReplyUnread?: boolean;
    clientInvitation: {
      status: 'pending' | 'expired' | 'revoked' | 'consumed';
      delivery: 'queued' | 'sending' | 'retrying' | 'accepted_by_provider' | 'failed' | 'unknown';
      expiresAt: string;
    } | null;
  };
}
export interface PmTicketQueuePage {
  items: PmTicketQueueItem[];
  nextCursor: string | null;
  counters: { kind: 'pm'; needsPm: number; inProgress: number; waitingClient: number; closedMonth: number };
}
export interface PmTicketClientGroup { key: string; displayName: string }
/** One client account, from GET /tickets/clients. */
export interface PmClientSummary {
  /** `client:<account>`; the queue's clientGroupKey filter takes it as is. */
  key: string;
  displayName: string;
  company: string | null;
  access: 'active' | 'inactive';
  tickets: {
    needsPm: number; waitingClient: number; open: number; closed: number; unlinkedOpen: number; accessRevoked: number;
    /** Requests with a client reply this PM has not read. Absent from servers that predate it. */
    unreadReplies?: number;
  };
  /** Exactly the projects the client portal shows this client. */
  projects: Array<{ projectId: string; name: string; previewPublished: boolean }>;
  lastActivityAt: string;
}

const boundedText = (value: unknown, allowEmpty = false): value is string => typeof value === 'string'
  && value.length <= 200 && value.trim() === value && (allowEmpty || value.length > 0);
const countValue = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** A project a client can talk about, for the client's Conversation tab. */
export interface PmClientProjectConversation {
  workspaceId: string; projectId: string; projectName: string; openRequests: number; lastActivityAt: string;
}
/** An open client request on a project, for linking a new task to it. */
export interface PmOpenRequest { ticketId: string; reference: string; title: string; clientId: string; clientName: string | null }
/** The client request a task belongs to. */
export interface PmTaskRequestLink { issueId: string; ticketId: string; reference: string; title: string; clientId: string | null }

/** One request on a client's page, with its newest client-visible message (never an internal note). */
export interface PmClientConversation {
  ticketId: string;
  latestMessage: { id: string; author: 'pm' | 'client'; preview: string; truncated: boolean; createdAt: string } | null;
}
export interface PmClientConversationPage { items: PmClientConversation[]; complete: boolean }

/** Strictly read a client conversation summary; anything unexpected is a failed response, not data. */
export function parseClientConversationPage(value: unknown): PmClientConversationPage {
  const invalid = (): never => { throw new Error('Client conversation response is invalid.'); };
  const record = (input: unknown) => (input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : invalid());
  const text = (input: unknown, max: number) => (typeof input === 'string' && input.length > 0 && input.length <= max ? input : invalid());
  const page = record(value);
  if (!Array.isArray(page.items) || page.items.length > 200 || typeof page.complete !== 'boolean') invalid();
  const ids = new Set<string>();
  const items = (page.items as unknown[]).map(entry => {
    const row = record(entry);
    const ticketId = text(row.ticketId, 200);
    if (ids.has(ticketId)) invalid();
    ids.add(ticketId);
    if (row.latestMessage === null) return { ticketId, latestMessage: null };
    const message = record(row.latestMessage);
    if ((message.author !== 'pm' && message.author !== 'client') || typeof message.preview !== 'string'
      || message.preview.length > 280 || typeof message.truncated !== 'boolean'
      || typeof message.createdAt !== 'string' || !Number.isFinite(Date.parse(message.createdAt))) invalid();
    return { ticketId, latestMessage: {
      id: text(message.id, 200), author: message.author as 'pm' | 'client', preview: message.preview as string,
      truncated: message.truncated as boolean, createdAt: message.createdAt as string,
    } };
  });
  return { items, complete: page.complete as boolean };
}

/** Parse one client summary, or throw: the page shows nothing it cannot trust. */
export function parsePmClientSummary(value: unknown): PmClientSummary {
  const invalid = () => new Error('Client list response is invalid.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const item = value as Record<string, unknown>;
  const tickets = item.tickets as Record<string, unknown> | null;
  if (!boundedText(item.key) || !/^client:\S+$/.test(item.key) || !boundedText(item.displayName)
    || (item.company !== null && !boundedText(item.company)) || (item.access !== 'active' && item.access !== 'inactive')
    || typeof item.lastActivityAt !== 'string' || !Number.isFinite(Date.parse(item.lastActivityAt))
    || !tickets || typeof tickets !== 'object' || !Array.isArray(item.projects)) throw invalid();
  const counts = ['needsPm', 'waitingClient', 'open', 'closed', 'unlinkedOpen', 'accessRevoked'] as const;
  if (!counts.every(name => countValue(tickets[name]))) throw invalid();
  if (tickets.unreadReplies !== undefined && !countValue(tickets.unreadReplies)) throw invalid();
  const projectIds = new Set<string>();
  const projects = item.projects.map(entry => {
    const project = entry as Record<string, unknown> | null;
    if (!project || typeof project !== 'object' || !boundedText(project.projectId) || projectIds.has(project.projectId)
      || !boundedText(project.name) || typeof project.previewPublished !== 'boolean') throw invalid();
    projectIds.add(project.projectId);
    return { projectId: project.projectId, name: project.name, previewPublished: project.previewPublished };
  });
  return {
    key: item.key, displayName: item.displayName, company: item.company as string | null, access: item.access,
    tickets: {
      ...Object.fromEntries(counts.map(name => [name, tickets[name] as number])) as PmClientSummary['tickets'],
      ...(tickets.unreadReplies === undefined ? {} : { unreadReplies: tickets.unreadReplies as number }),
    },
    projects, lastActivityAt: item.lastActivityAt,
  };
}
export interface PmTicketMessage { id: string; author: 'pm' | 'client'; body: string; createdAt: string }
export interface PmTicketNote extends PmTicketMessage { authorId: string }
export interface PmTicketPage<T> { items: T[]; nextCursor: string | null }
export interface PmTicketReceipt {
  ticketId: string; operationId: string; version: number; status: TicketStatus;
  messageId?: string; reference?: string;
}
export interface PmProjectClientPreview { repository: string; branch: 'main' | 'uat'; url: string }
export interface PmProjectClientPreviewState { preview: PmProjectClientPreview | null }
export interface PmProjectPreviewClient { clientId: string; displayName: string }
export interface PmProjectFeedbackMessage { id: string; clientId: string; author: 'pm' | 'client'; body: string; createdAt: string }
export interface PmProjectFeedbackInput { schemaVersion: 1; operationId: string; body: string }
export interface PmProjectFeedbackReceipt { messageId: string; operationId: string }

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
  sharedProjectPreviewUrl?: string | null;
  relatedTicket: { id: string; reference: string; title: string } | null;
  /** approvedBy: the client, or the PM using their discretion to skip client approval. */
  scope: { id: string; summary: string; proposedAt: string; agreed: boolean; approvedBy?: 'client' | 'pm' | null } | null;
  delivery: { id: string; scopeVersionId: string; summary: string; sharedAt: string; accepted: boolean } | null;
  request: { projectPreference: 'not_sure' | 'new_project' | 'shared_project'; projectLabel: string | null; requestedDeadline: string | null } | null;
  internal: {
    updatedAt: string;
    projectId: string | null;
    projectName?: string | null;
    projectClientVisible?: boolean;
    projectPreview?: { repository: string; branch: 'main' | 'uat'; url: string } | null;
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
      contact: { fullName: string; email: string; company: string | null; verification: 'verified' | 'unverified_submission' } | null;
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
  clientGroupKey?: string;
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
  | { type: 'propose_scope'; scopeVersionId: string; clientApproval?: 'required' | 'skipped' }
  | { type: 'skip_scope_approval'; scopeVersionId: string }
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
  /** 'skipped' starts work without waiting for the client to approve the plan. */
  clientApproval?: 'required' | 'skipped';
}
export interface PmTicketScopeProposalReceipt extends PmTicketReceipt {
  scopeVersionId: string;
}
export interface PmTicketResultInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  publicSummary: string;
}
export interface PmTicketInvitationReceipt {
  ticketId: string;
  invitationId: string;
  expiresAt: string;
  status: 'pending';
  alreadyPending: boolean;
}
export interface PmTicketProjectLinkInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  projectId: string | null;
  clientVisible: boolean;
  projectPreview?: { repository: string; branch: 'main' | 'uat'; url: string } | null;
}
export interface PmTicketProjectLinkReceipt extends PmTicketReceipt {
  projectId: string | null;
  projectName: string | null;
  clientVisible: boolean;
  projectPreview: { repository: string; branch: 'main' | 'uat'; url: string } | null;
}
export interface PmPublicInquiryCode { code: string; submissionEnabled: boolean }
export interface PmCentralIntakeMessage { id: string; author: 'pm' | 'client'; body: string; createdAt: string }
export interface PmCentralIntakeItem {
  kind: 'public_inquiry' | 'project_proposal';
  status?: 'pending' | 'awaiting_client' | 'accepted' | 'declined';
  clarificationMessages?: PmCentralIntakeMessage[];
  handledAt?: string | null;
  outcomeEmailStatus?: 'pending' | 'retry' | 'leased' | 'delivered' | 'dead' | null;
  id: string; publicReference?: string; fullName: string; email: string; company: string | null; title: string;
  description: string; requestedDeadline: string | null; submittedAt: string;
  /** Accepted into this workspace: the request it became, and that request's project once linked. */
  acceptedTicketId?: string; acceptedTicketReference?: string;
  acceptedProjectId?: string | null; acceptedProjectName?: string | null;
}
/** Start a project from an inquiry: a new one from these details, or an existing one. */
export type PmIntakeProjectChoice = { name: string; key?: string; description?: string; targetDate?: string } | { existingProjectId: string };
export interface PmIntakeProjectStart {
  ticketId: string; reference: string; projectId: string; projectName: string; projectKey: string; created: boolean; clientVisible: boolean;
}
export interface PmCentralIntakePage { items: PmCentralIntakeItem[]; nextCursor: string | null }
export interface PmCentralIntakeAcceptance { ticketId: string; workspaceId: string; reference: string; operationId: string }
export interface PmCentralIntakeDecline { intakeId: string; operationId: string; status: 'declined' }
export interface PmCentralIntakeClarify { intakeId: string; operationId: string; status: 'awaiting_client' }
export type PmTicketInvitationEmailReceipt = PmTicketInvitationReceipt;

function encodeId(value: string): string { return encodeURIComponent(value); }
/** What an accepted inquiry became, when the server says: its request and that request's project. */
function acceptedOutcome(row: Record<string, unknown>): Pick<PmCentralIntakeItem, 'acceptedTicketId' | 'acceptedTicketReference' | 'acceptedProjectId' | 'acceptedProjectName'> {
  if (typeof row.acceptedTicketId !== 'string' || typeof row.acceptedTicketReference !== 'string'
    || !/^TKT-[A-F0-9]{32}$/.test(row.acceptedTicketReference)) return {};
  const optional = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
  return { acceptedTicketId: row.acceptedTicketId, acceptedTicketReference: row.acceptedTicketReference,
    acceptedProjectId: optional(row.acceptedProjectId), acceptedProjectName: optional(row.acceptedProjectName) };
}
function query(values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined) params.set(key, value);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

async function withOperationRecovery<T>(
  submit: () => Promise<T>, lookup: () => Promise<T>,
): Promise<T> {
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
  async getWorkflowCapabilities(): Promise<{ phaseWorkflowEnabled: boolean }> {
    const value = await apiService.ticketRequest<unknown>('/tickets/workflow-capabilities');
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof (value as Record<string, unknown>).phaseWorkflowEnabled !== 'boolean') {
      throw new Error('Ticket workflow capabilities response is invalid.');
    }
    return { phaseWorkflowEnabled: (value as { phaseWorkflowEnabled: boolean }).phaseWorkflowEnabled };
  },
  /** `client` (a client account ID) narrows the page to that client's project proposals. */
  async listCentralIntakes(after: string | null = null, filter: 'pending' | 'handled' = 'pending', client?: string): Promise<PmCentralIntakePage> {
    const value = await apiService.ticketRequest<unknown>(`/tickets/intakes${query({ limit: '50', after, ...(filter === 'handled' ? { filter } : {}), ...(client ? { client } : {}) })}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Shared inquiry response is invalid.');
    const page = value as Record<string, unknown>;
    if (!Array.isArray(page.items) || (page.nextCursor !== null && typeof page.nextCursor !== 'string')) {
      throw new Error('Shared inquiry response is invalid.');
    }
    const items = page.items.map((value): PmCentralIntakeItem => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Shared inquiry response is invalid.');
      const row = value as Record<string, unknown>;
      if (row.kind !== undefined && row.kind !== 'public_inquiry' && row.kind !== 'project_proposal') {
        throw new Error('Shared intake item kind is invalid.');
      }
      if ((row.status !== undefined && !['pending', 'awaiting_client', 'accepted', 'declined'].includes(String(row.status)))
        || (row.handledAt != null && (typeof row.handledAt !== 'string' || !Number.isFinite(Date.parse(row.handledAt))))
        || (row.outcomeEmailStatus != null && !['pending', 'retry', 'leased', 'delivered', 'dead'].includes(String(row.outcomeEmailStatus)))) {
        throw new Error('Shared inquiry status is invalid.');
      }
      if (typeof row.id !== 'string' || !row.id.trim() || typeof row.fullName !== 'string' || !row.fullName.trim()
        || (row.publicReference !== undefined && (typeof row.publicReference !== 'string' || !/^INQ-[A-F0-9]{32}$/.test(row.publicReference)))
        || typeof row.email !== 'string' || !row.email.trim()
        || (row.company !== null && typeof row.company !== 'string')
        || typeof row.title !== 'string' || !row.title.trim() || typeof row.description !== 'string' || !row.description.trim()
        || (row.requestedDeadline !== null && typeof row.requestedDeadline !== 'string')
        || typeof row.submittedAt !== 'string' || !Number.isFinite(Date.parse(row.submittedAt))) {
        throw new Error('Shared inquiry response is invalid.');
      }
      const clarificationRows = row.clarificationMessages ?? [];
      if (!Array.isArray(clarificationRows) || clarificationRows.length > 100) throw new Error('Shared inquiry messages are invalid.');
      const clarificationMessages = clarificationRows.map((rawMessage): PmCentralIntakeMessage => {
        if (!rawMessage || typeof rawMessage !== 'object' || Array.isArray(rawMessage)) throw new Error('Shared inquiry messages are invalid.');
        const message = rawMessage as Record<string, unknown>;
        if (typeof message.id !== 'string' || !message.id.trim() || (message.author !== 'pm' && message.author !== 'client')
          || typeof message.body !== 'string' || !message.body.trim() || message.body.length > 4000
          || typeof message.createdAt !== 'string' || !Number.isFinite(Date.parse(message.createdAt))) {
          throw new Error('Shared inquiry messages are invalid.');
        }
        return { id: message.id, author: message.author, body: message.body, createdAt: message.createdAt };
      });
      return { kind: row.kind === 'project_proposal' ? 'project_proposal' : 'public_inquiry',
        id: row.id, ...(typeof row.publicReference === 'string' ? { publicReference: row.publicReference } : {}), fullName: row.fullName, email: row.email, company: row.company as string | null,
        title: row.title, description: row.description, requestedDeadline: row.requestedDeadline as string | null,
        submittedAt: row.submittedAt,
        clarificationMessages,
        ...(row.status !== undefined ? { status: row.status as PmCentralIntakeItem['status'] } : {}),
        ...(row.handledAt !== undefined ? { handledAt: row.handledAt as string | null } : {}),
        ...(row.outcomeEmailStatus !== undefined ? { outcomeEmailStatus: row.outcomeEmailStatus as PmCentralIntakeItem['outcomeEmailStatus'] } : {}),
        ...acceptedOutcome(row) };
    });
    return { items, nextCursor: page.nextCursor as string | null };
  },
  /** Accept, create (or pick) the project and link them in one action. Retry with the same operationId. */
  async startProjectFromIntake(intakeId: string, operationId: string, project: PmIntakeProjectChoice, clientVisible: boolean): Promise<PmIntakeProjectStart> {
    const value = await apiService.ticketRequest<unknown>(`/tickets/intakes/${encodeId(intakeId)}/start-project`, {
      method: 'POST', body: JSON.stringify({ schemaVersion: 1, operationId, project, clientVisible }),
    });
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Project start response is invalid.');
    const row = value as Record<string, unknown>;
    const text = (field: unknown): field is string => typeof field === 'string' && field.trim().length > 0;
    if (!text(row.ticketId) || typeof row.reference !== 'string' || !/^TKT-[A-F0-9]{32}$/.test(row.reference)
      || !text(row.projectId) || !text(row.projectName) || !text(row.projectKey)
      || typeof row.created !== 'boolean' || typeof row.clientVisible !== 'boolean') throw new Error('Project start response is invalid.');
    return { ticketId: row.ticketId, reference: row.reference, projectId: row.projectId, projectName: row.projectName,
      projectKey: row.projectKey, created: row.created, clientVisible: row.clientVisible };
  },
  async acceptCentralIntake(intakeId: string, operationId: string): Promise<PmCentralIntakeAcceptance> {
    const value = await apiService.ticketRequest<unknown>(`/tickets/intakes/${encodeId(intakeId)}/accept`, {
      method: 'POST', body: JSON.stringify({ schemaVersion: 1, operationId }),
    });
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Inquiry acceptance response is invalid.');
    const row = value as Record<string, unknown>;
    if (typeof row.ticketId !== 'string' || !row.ticketId.trim() || typeof row.workspaceId !== 'string' || !row.workspaceId.trim()
      || typeof row.reference !== 'string' || !/^TKT-[A-F0-9]{32}$/.test(row.reference)
      || row.operationId !== operationId) throw new Error('Inquiry acceptance response is invalid.');
    return { ticketId: row.ticketId, workspaceId: row.workspaceId, reference: row.reference, operationId };
  },
  async declineCentralIntake(intakeId: string, operationId: string, reason: string | null = null): Promise<PmCentralIntakeDecline> {
    const value = await apiService.ticketRequest<unknown>(`/tickets/intakes/${encodeId(intakeId)}/decline`, {
      method: 'POST', body: JSON.stringify({ schemaVersion: 1, operationId, ...(reason ? { reason } : {}) }),
    });
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Inquiry decline response is invalid.');
    const row = value as Record<string, unknown>;
    if (row.intakeId !== intakeId || row.operationId !== operationId || row.status !== 'declined') throw new Error('Inquiry decline response is invalid.');
    return { intakeId, operationId, status: 'declined' };
  },
  async clarifyCentralIntake(intakeId: string, operationId: string, body: string): Promise<PmCentralIntakeClarify> {
    const value = await apiService.ticketRequest<unknown>(`/tickets/intakes/${encodeId(intakeId)}/clarify`, {
      method: 'POST', body: JSON.stringify({ schemaVersion: 1, operationId, body }),
    });
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Clarification response is invalid.');
    const row = value as Record<string, unknown>;
    if (row.intakeId !== intakeId || row.operationId !== operationId || row.status !== 'awaiting_client') {
      throw new Error('Clarification response is invalid.');
    }
    return { intakeId, operationId, status: 'awaiting_client' };
  },
  async getPublicInquiryCode(): Promise<PmPublicInquiryCode> {
    const value = await apiService.ticketRequest<unknown>('/tickets/inquiry-code');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Inquiry code response is invalid.');
    const record = value as Record<string, unknown>;
    if (typeof record.code !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(record.code)
      || typeof record.submissionEnabled !== 'boolean') throw new Error('Inquiry code response is invalid.');
    return { code: record.code, submissionEnabled: record.submissionEnabled };
  },
  list(options: PmTicketQueueOptions = {}) {
    return apiService.ticketRequest<PmTicketQueuePage>(`/tickets${query({
      limit: options.limit === undefined ? undefined : String(options.limit),
      after: options.after, search: options.search, filter: options.filter, clientGroupKey: options.clientGroupKey,
    })}`);
  },
  async listClientGroups(): Promise<PmTicketClientGroup[]> {
    const value = await apiService.ticketRequest<unknown>('/tickets/client-groups');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Client list response is invalid.');
    const items = (value as Record<string, unknown>).items;
    if (!Array.isArray(items)) throw new Error('Client list response is invalid.');
    const keys = new Set<string>();
    return items.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Client list response is invalid.');
      const group = item as Record<string, unknown>;
      if (typeof group.key !== 'string' || !group.key.trim() || group.key.trim() !== group.key || group.key.length > 200
        || typeof group.displayName !== 'string' || !group.displayName.trim() || group.displayName.trim() !== group.displayName
        || group.displayName.length > 200 || keys.has(group.key)) throw new Error('Client list response is invalid.');
      keys.add(group.key);
      return { key: group.key, displayName: group.displayName };
    });
  },
  /** A client's page: the newest client-visible message on each of their requests. Read-only. */
  async listClientConversations(clientGroupKey: string): Promise<PmClientConversationPage> {
    return parseClientConversationPage(await apiService.ticketRequest<unknown>(
      `/tickets/clients/${encodeId(clientGroupKey)}/conversations`));
  },
  /** A client account's project proposals, open and handled, newest first (the latest 50 of each). */
  async listClientProposals(clientGroupKey: string): Promise<PmCentralIntakeItem[]> {
    if (!/^client:\S+$/.test(clientGroupKey)) return [];
    const client = clientGroupKey.slice('client:'.length);
    const pages = await Promise.all([
      pmTicketApi.listCentralIntakes(null, 'pending', client),
      pmTicketApi.listCentralIntakes(null, 'handled', client),
    ]);
    return pages.flatMap(page => page.items).filter(item => item.kind === 'project_proposal')
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  },
  async listClients(): Promise<PmClientSummary[]> {
    const value = await apiService.ticketRequest<unknown>('/tickets/clients');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Client list response is invalid.');
    const items = (value as Record<string, unknown>).items;
    if (!Array.isArray(items)) throw new Error('Client list response is invalid.');
    const keys = new Set<string>();
    return items.map(item => {
      const client = parsePmClientSummary(item);
      if (keys.has(client.key)) throw new Error('Client list response is invalid.');
      keys.add(client.key);
      return client;
    });
  },
  get(ticketId: string) {
    return apiService.ticketRequest<PmTicketDetail>(`/tickets/${encodeId(ticketId)}`);
  },
  async getDelivery(ticketId: string, deliveryId: string, signal?: AbortSignal) {
    const value = await apiService.ticketRequest<unknown>(`/tickets/${encodeId(ticketId)}/deliveries/${encodeId(deliveryId)}`, { signal });
    return parseClientDeliveryManifest(value, deliveryId);
  },
  prepareResult(ticketId: string, input: PmTicketResultInput, signal?: AbortSignal) {
    // Do not automatically repeat an uncertain POST. Refresh candidates before retrying.
    return apiService.ticketRequest<unknown>(`/tickets/${encodeId(ticketId)}/results`, {
      method: 'POST', body: JSON.stringify(input), signal,
    });
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
  async getDocuments(ticketId: string) {
    return parseTicketDocumentList(await apiService.ticketRequest<unknown>(`/tickets/${encodeId(ticketId)}/documents`));
  },
  downloadDocument(ticketId: string, documentId: string) {
    return apiService.ticketDownloadDocument(
      `/tickets/${encodeId(ticketId)}/documents/${encodeId(documentId)}/content`,
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
  linkProject(ticketId: string, input: PmTicketProjectLinkInput) {
    return apiService.ticketRequest<PmTicketProjectLinkReceipt>(
      `/tickets/${encodeId(ticketId)}/project`, { method: 'PUT', body: JSON.stringify(input) },
    );
  },
  async getProjectClientPreview(projectId: string) {
    try {
      return await apiService.ticketRequest<PmProjectClientPreviewState>(
        `/tickets/projects/${encodeId(projectId)}/client-preview`,
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 503
        && error.message.includes('Ticket changes are not enabled yet.')) {
        return { preview: null };
      }
      throw error;
    }
  },
  setProjectClientPreview(projectId: string, preview: PmProjectClientPreview | null) {
    return apiService.ticketRequest<PmProjectClientPreviewState>(
      `/tickets/projects/${encodeId(projectId)}/client-preview`,
      { method: 'PUT', body: JSON.stringify({ preview }) },
    );
  },
  listProjectPreviewClients(projectId: string) {
    return apiService.ticketRequest<{ items: PmProjectPreviewClient[] }>(
      `/tickets/projects/${encodeId(projectId)}/client-preview/clients`,
    );
  },
  getProjectFeedbackMessages(projectId: string, clientId: string, options: { limit?: number; before?: string | null } = {}) {
    return apiService.ticketRequest<PmTicketPage<PmProjectFeedbackMessage>>(
      `/tickets/projects/${encodeId(projectId)}/client-preview/messages${query({
        clientId, limit: options.limit === undefined ? undefined : String(options.limit), before: options.before,
      })}`,
    );
  },
  sendProjectFeedbackMessage(projectId: string, clientId: string, input: PmProjectFeedbackInput) {
    return withOperationRecovery(
      () => apiService.ticketRequest<PmProjectFeedbackReceipt>(
        `/tickets/projects/${encodeId(projectId)}/client-preview/messages${query({ clientId })}`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
      () => pmTicketApi.getProjectFeedbackOperation(projectId, clientId, input.operationId),
    );
  },
  /** The projects a client can talk about, newest activity first. */
  async listClientProjectConversations(clientId: string): Promise<PmClientProjectConversation[]> {
    const value = await apiService.ticketRequest<unknown>(`/tickets/clients/${encodeId(clientId)}/project-conversations`);
    const items = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).items : null;
    if (!Array.isArray(items)) throw new Error('Client project list is invalid.');
    return items.map(item => {
      const row = item as Record<string, unknown>;
      if (!row || typeof row.projectId !== 'string' || typeof row.projectName !== 'string' || typeof row.workspaceId !== 'string'
        || !Number.isSafeInteger(row.openRequests) || typeof row.lastActivityAt !== 'string') throw new Error('Client project list is invalid.');
      return { workspaceId: row.workspaceId, projectId: row.projectId, projectName: row.projectName,
        openRequests: row.openRequests as number, lastActivityAt: row.lastActivityAt };
    });
  },
  async getProjectConversation(projectId: string, clientId: string) {
    return parseConversation(await apiService.ticketRequest<unknown>(
      `/tickets/projects/${encodeId(projectId)}/conversation${query({ clientId })}`));
  },
  async getProjectConversationRequests(projectId: string, clientId: string) {
    return parseConversationRequests(await apiService.ticketRequest<unknown>(
      `/tickets/projects/${encodeId(projectId)}/conversation/requests${query({ clientId })}`));
  },
  async setConversationRequestDone(projectId: string, clientId: string, ticketId: string, done: boolean) {
    return parseConversationRequest(await apiService.ticketRequest<unknown>(
      `/tickets/projects/${encodeId(projectId)}/conversation/requests/${encodeId(ticketId)}/check${query({ clientId })}`,
      { method: 'POST', body: JSON.stringify({ done }) }));
  },
  /** Open client requests on a project, for the New task dialog. */
  listOpenRequests(projectId: string) {
    return apiService.ticketRequest<{ items: PmOpenRequest[] }>(`/tickets/projects/${encodeId(projectId)}/open-requests`);
  },
  /** Which client request each task on a project belongs to. */
  listTaskRequestLinks(projectId: string) {
    return apiService.ticketRequest<{ items: PmTaskRequestLink[] }>(`/tickets/projects/${encodeId(projectId)}/request-links`);
  },
  linkTaskToRequest(ticketId: string, issueId: string, source: 'conversation' | 'task_dialog' = 'conversation') {
    return apiService.ticketRequest<{ ticketId: string; issueId: string }>(`/tickets/requests/${encodeId(ticketId)}/task-links`,
      { method: 'POST', body: JSON.stringify({ issueId, source }) });
  },
  unlinkTaskFromRequest(ticketId: string, issueId: string) {
    return apiService.ticketRequest<{ ticketId: string; issueId: string }>(
      `/tickets/requests/${encodeId(ticketId)}/task-links/${encodeId(issueId)}`, { method: 'DELETE' });
  },
  getProjectFeedbackOperation(projectId: string, clientId: string, operationId: string) {
    return apiService.ticketRequest<PmProjectFeedbackReceipt>(
      `/tickets/projects/${encodeId(projectId)}/client-preview/messages/operations/${encodeId(operationId)}${query({ clientId })}`,
    );
  },
};

export const pmTicketDocumentsApi: TicketDocumentsReadApi = {
  list: (_workspaceId, ticketId) => pmTicketApi.getDocuments(ticketId),
  download: (_workspaceId, ticketId, documentId) => pmTicketApi.downloadDocument(ticketId, documentId),
};
