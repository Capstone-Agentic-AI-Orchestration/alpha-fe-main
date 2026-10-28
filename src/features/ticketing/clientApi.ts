import { parseClientDeliveryFile, parseClientDeliveryManifest, readClientDeliveryFile, type ClientDeliveryFile } from './clientDelivery';
import { ClientTicketApiError } from './clientApiError';
import { parseTicketDocument, parseTicketDocumentList, type TicketDocumentsApi } from './ticketDocuments';
export { ClientTicketApiError } from './clientApiError';

/** Browser-only client portal transport.
 *
 * Deliberately does not use the internal apiService/API_BASE: that helper can
 * address the desktop daemon and attach the Alpha local token. Client session
 * cookies must stay on the same web origin and must never be forwarded to the
 * desktop daemon.
 */
const API_ROOT = '/api/client';
const CLIENT_CSRF_COOKIE = 'alpha_client_csrf';
const DEV_CSRF_COOKIE = 'alpha_client_csrf_dev';

export type ClientTicketStatus =
  | 'received' | 'under_review' | 'awaiting_client' | 'in_progress' | 'ready_for_review'
  | 'on_hold' | 'closed' | 'declined' | 'cancelled';

export interface ClientWorkspaceOption { workspaceId: string; displayName: string }
export interface ClientProjectPreview {
  repository: string;
  branch: 'main' | 'uat';
  url: string;
}
export interface ClientProject {
  workspaceId: string;
  projectId: string;
  name: string;
  updatedAt: string;
  intakeOptionId: string;
  preview: ClientProjectPreview | null;
}
export interface ClientTicketIntakeContext {
  intakeContextId: string;
  canCreate: boolean;
  sharedProjects: Array<{ optionId: string; displayName: string }>;
}
export interface ClientTicketQueueItem {
  id: string; reference: string; title: string; status: ClientTicketStatus;
  createdAt: string; updatedAt: string; closedAt: string | null;
  readOnly: boolean; writesAvailable: boolean;
  requestedAction: 'reply' | 'agree_scope' | 'review_result' | null;
}
/** Server-authorized client request row; projectId describes an actual PM link only. */
export interface ClientProjectRequestItem extends ClientTicketQueueItem {
  workspaceId: string;
  projectId: string | null;
  projectName: string | null;
  /** Set only while an inquiry's project preference awaits PM review. */
  projectLinkStatus: 'linked' | 'pending_review' | null;
  /** Client-safe label for the requested project; never used for access or matching. */
  requestedProjectName: string | null;
}
export interface ClientTicketDetail extends ClientTicketQueueItem {
  description: string;
  companyLabel: string;
  version: number;
  sharedProjectName: string | null;
  sharedProjectPreviewUrl?: string | null;
  relatedTicket: { id: string; reference: string; title: string } | null;
  scope: { id: string; summary: string; proposedAt: string; agreed: boolean } | null;
  delivery: { id: string; scopeVersionId: string; summary: string; sharedAt: string; accepted: boolean } | null;
  request: {
    projectPreference: 'not_sure' | 'new_project' | 'shared_project';
    projectLabel: string | null;
    requestedDeadline: string | null;
  } | null;
}
export interface ClientTicketMessage { id: string; author: 'pm' | 'client'; body: string; createdAt: string }
export interface ClientTicketPage<T> { items: T[]; nextCursor: string | null }
export interface ClientTicketQueue extends ClientTicketPage<ClientTicketQueueItem> {
  counters: { kind: 'client'; open: number; needsClient: number };
}
export interface ClientProjectRequestQueue extends ClientTicketPage<ClientProjectRequestItem> {
  counters: { kind: 'client'; open: number; needsClient: number };
}
export interface ClientProjectFeedbackMessage { id: string; author: 'pm' | 'client'; body: string; createdAt: string }
export interface ClientProjectFeedbackInput { schemaVersion: 1; operationId: string; body: string }
export interface ClientProjectFeedbackReceipt { messageId: string; operationId: string }
export interface ClientTicketReceipt {
  ticketId: string; operationId: string; version: number; status: ClientTicketStatus;
  reference?: string; messageId?: string;
}
export interface ClientSession { authenticated: boolean; email?: string; expiresAt?: string }
export type ClientEmailLinkType = 'invite' | 'magiclink';
export interface ClientTicketCreateInput {
  intakeContextId: string;
  schemaVersion: 1;
  operationId: string;
  title: string;
  description: string;
  relatedTicketId?: string | null;
  projectPreference?: { kind: 'not_sure' } | { kind: 'new_project' } | { kind: 'shared_project'; optionId: string };
  requestedDeadline?: string | null;
}
export interface ClientTicketReplyInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  body: string;
  action?: { type: 'reply' } | { type: 'request_details' } | { type: 'answer_close' }
    | { type: 'request_correction'; deliveryId: string };
}
export interface ClientTicketCommandInput {
  schemaVersion: 1;
  operationId: string;
  expectedVersion: number;
  command:
    | { type: 'agree_scope'; scopeVersionId: string }
    | { type: 'accept_delivery'; deliveryId: string }
    | { type: 'request_withdrawal'; reason: string };
}
export interface ClientTicketQueueOptions {
  limit?: number; after?: string | null; search?: string;
  filter?: 'all' | 'history' | 'open' | 'needs_client';
}

function browserOriginAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'https:') return true;
  return window.location.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

function csrfToken(): string {
  if (typeof document === 'undefined') throw new ClientTicketApiError(null, 'This request could not be verified.');
  const name = window.location.protocol === 'https:' ? CLIENT_CSRF_COOKIE : DEV_CSRF_COOKIE;
  const matches = document.cookie.split(';').map(value => value.trim())
    .filter(value => value.slice(0, value.indexOf('=')) === name);
  if (matches.length !== 1) throw new ClientTicketApiError(null, 'This request could not be verified. Refresh and try again.');
  const raw = matches[0].slice(name.length + 1);
  let value: string;
  try { value = decodeURIComponent(raw); }
  catch { throw new ClientTicketApiError(null, 'This request could not be verified. Refresh and try again.'); }
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new ClientTicketApiError(null, 'This request could not be verified. Refresh and try again.');
  }
  return value;
}

function safeHttpError(status: number): string {
  if (status === 401) return 'Sign in to continue.';
  if (status === 403) return 'We could not verify this action. Refresh the page and try again.';
  if (status === 404) return 'This request or invitation is no longer available.';
  if (status === 409) return 'This request changed or was already updated. Refresh and check its current status.';
  if (status === 429) return 'Too many attempts. Wait a little, then try again.';
  if (status >= 500) return 'Alphaexplora is temporarily unavailable. Please try again later.';
  return 'We could not complete that action. Check the details and try again.';
}

async function apiError(response: Response): Promise<ClientTicketApiError> {
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  const value = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown> : null;
  const code = typeof value?.code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value.code)
    ? value.code : null;
  const reconciliationRequired = value?.reconciliationRequired === true
    || code?.endsWith('_outcome_unknown') === true;
  return new ClientTicketApiError(
    response.status,
    reconciliationRequired
      ? 'The result is uncertain. Checking whether your request went through; do not submit it again yet.'
      : safeHttpError(response.status),
    code,
    reconciliationRequired,
  );
}

async function withOperationRecovery<T>(
  submit: () => Promise<T>,
  lookup: () => Promise<T>,
): Promise<T> {
  try { return await submit(); }
  catch (error) {
    if (!(error instanceof ClientTicketApiError) || !error.reconciliationRequired) throw error;
    try { return await lookup(); }
    catch (lookupError) {
      if (!(lookupError instanceof ClientTicketApiError) || lookupError.status !== 404) throw lookupError;
    }
    // The operation is absent (or access was revoked). Retrying the identical
    // payload with the same ID is safe: the service's unique operation key
    // returns the original outcome instead of creating another effect.
    return submit();
  }
}

interface RequestOptions extends RequestInit { csrf?: boolean; accept?: string }

async function requestResponse(path: string, options: RequestOptions = {}): Promise<Response> {
  if (!browserOriginAllowed()) {
    throw new ClientTicketApiError(null, 'For your safety, open Alphaexplora in its secure website to access your requests.');
  }
  const { csrf: csrfOverride, accept = 'application/json', ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
  const csrfRequired = csrfOverride ?? !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = new Headers(options.headers);
  headers.set('Accept', accept);
  if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (csrfRequired) headers.set('X-CSRF-Token', csrfToken());

  let response: Response;
  try {
    const timeout = AbortSignal.timeout(30_000);
    response = await fetch(`${API_ROOT}${path}`, {
      ...fetchOptions,
      signal: fetchOptions.signal ? AbortSignal.any([fetchOptions.signal, timeout]) : timeout,
      headers,
      credentials: 'same-origin',
      mode: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    const writeOutcomeUnknown = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    throw new ClientTicketApiError(
      null,
      writeOutcomeUnknown
        ? 'The connection ended before the result was confirmed. Checking whether your request went through; do not submit it again yet.'
        : 'Could not connect to Alphaexplora. Check your internet connection and try again.',
      writeOutcomeUnknown ? 'transport_outcome_unknown' : null,
      writeOutcomeUnknown,
    );
  }
  if (!response.ok) throw await apiError(response);
  return response;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestResponse(path, options);
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ClientTicketApiError(response.status, 'We could not read the response. Reload the page and try again.'); }
}

function pathId(value: string): string { return encodeURIComponent(value); }
function pageQuery(options: { limit?: number; after?: string | null; before?: string | null; search?: string; filter?: string }): string {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.after) query.set('after', options.after);
  if (options.before) query.set('before', options.before);
  if (options.search) query.set('search', options.search);
  if (options.filter) query.set('filter', options.filter);
  const value = query.toString();
  return value ? `?${value}` : '';
}

/** Client-only HTTP facade; provider tokens are exchanged immediately and never persisted. */
export const clientTicketApi = {
  getWorkflowCapabilities() {
    return requestJson<{ phaseWorkflowEnabled: boolean }>('/workflow-capabilities');
  },
  activateInvitation(invitationToken: string, providerTokenHash: string, providerTokenType: ClientEmailLinkType) {
    return requestJson<{ activated: true }>('/auth/activate', {
      method: 'POST', csrf: false,
      body: JSON.stringify({ invitationToken, providerTokenHash, providerTokenType }),
    });
  },
  getSession() { return requestJson<ClientSession>('/session'); },
  signOut() { return requestJson<void>('/session/logout', { method: 'POST', body: '{}' }); },
  listWorkspaces() {
    return requestJson<{ items: ClientWorkspaceOption[] }>('/workspaces');
  },
  async listProjects(): Promise<{ items: ClientProject[] }> {
    const value = await requestJson<unknown>('/projects');
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray((value as Record<string, unknown>).items)) {
      throw new ClientTicketApiError(null, 'Your shared projects could not be read. Reload the portal and try again.');
    }
    const items = ((value as { items: unknown[] }).items).map((raw): ClientProject => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ClientTicketApiError(null, 'Your shared projects could not be read. Reload the portal and try again.');
      const row = raw as Record<string, unknown>;
      const preview = row.preview;
      const previewIsValid = preview === null || (typeof preview === 'object' && !Array.isArray(preview)
        && typeof (preview as Record<string, unknown>).repository === 'string'
        && ((preview as Record<string, unknown>).branch === 'main' || (preview as Record<string, unknown>).branch === 'uat')
        && typeof (preview as Record<string, unknown>).url === 'string');
      if (typeof row.workspaceId !== 'string' || !row.workspaceId.trim()
        || typeof row.projectId !== 'string' || !row.projectId.trim()
        || typeof row.name !== 'string' || !row.name.trim()
        || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))
        || typeof row.intakeOptionId !== 'string' || !row.intakeOptionId.trim()
        || !previewIsValid) {
        throw new ClientTicketApiError(null, 'Your shared projects could not be read. Reload the portal and try again.');
      }
      return { workspaceId: row.workspaceId, projectId: row.projectId, name: row.name, updatedAt: row.updatedAt,
        intakeOptionId: row.intakeOptionId, preview: preview as ClientProjectPreview | null };
    });
    return { items };
  },
  listRequests(options: ClientTicketQueueOptions = {}) {
    return requestJson<ClientProjectRequestQueue>(`/requests${pageQuery(options)}`);
  },
  listProjectRequests(workspaceId: string, projectId: string, options: ClientTicketQueueOptions = {}) {
    return requestJson<ClientProjectRequestQueue>(
      `/projects/${pathId(workspaceId)}/${pathId(projectId)}/requests${pageQuery(options)}`,
    );
  },
  getProjectFeedbackMessages(workspaceId: string, projectId: string, options: { limit?: number; before?: string | null } = {}) {
    return requestJson<ClientTicketPage<ClientProjectFeedbackMessage>>(
      `/projects/${pathId(workspaceId)}/${pathId(projectId)}/preview/messages${pageQuery(options)}`,
    );
  },
  sendProjectFeedbackMessage(workspaceId: string, projectId: string, input: ClientProjectFeedbackInput) {
    return withOperationRecovery(
      () => requestJson<ClientProjectFeedbackReceipt>(
        `/projects/${pathId(workspaceId)}/${pathId(projectId)}/preview/messages`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
      () => clientTicketApi.getProjectFeedbackOperation(workspaceId, projectId, input.operationId),
    );
  },
  getProjectFeedbackOperation(workspaceId: string, projectId: string, operationId: string) {
    return requestJson<ClientProjectFeedbackReceipt>(
      `/projects/${pathId(workspaceId)}/${pathId(projectId)}/preview/messages/operations/${pathId(operationId)}`,
    );
  },
  getIntakeContext(workspaceId: string) {
    return requestJson<ClientTicketIntakeContext>(`/workspaces/${pathId(workspaceId)}/intake-context`);
  },
  listTickets(workspaceId: string, options: ClientTicketQueueOptions = {}) {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    if (options.after) query.set('after', options.after);
    if (options.search) query.set('search', options.search);
    if (options.filter) query.set('filter', options.filter);
    const encoded = query.toString();
    const suffix = encoded ? `?${encoded}` : '';
    return requestJson<ClientTicketQueue>(`/workspaces/${pathId(workspaceId)}/tickets${suffix}`);
  },
  createTicket(input: ClientTicketCreateInput) {
    return withOperationRecovery(
      () => requestJson<ClientTicketReceipt>('/tickets', { method: 'POST', body: JSON.stringify(input) }),
      () => clientTicketApi.getCreateOperation(input.intakeContextId, input.operationId),
    );
  },
  getCreateOperation(intakeContextId: string, operationId: string) {
    const query = new URLSearchParams({ intakeContextId }).toString();
    return requestJson<ClientTicketReceipt>(`/tickets/operations/${pathId(operationId)}?${query}`);
  },
  getTicket(workspaceId: string, ticketId: string) {
    return requestJson<ClientTicketDetail>(`/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}`);
  },
  async getDelivery(workspaceId: string, ticketId: string, deliveryId: string, signal?: AbortSignal) {
    const value = await requestJson<unknown>(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/deliveries/${pathId(deliveryId)}`, { signal },
    );
    return parseClientDeliveryManifest(value, deliveryId);
  },
  async getDeliveryFile(workspaceId: string, ticketId: string, deliveryId: string, input: ClientDeliveryFile, signal?: AbortSignal) {
    const file = parseClientDeliveryFile(input);
    const response = await requestResponse(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/deliveries/${pathId(deliveryId)}/files/${pathId(file.id)}`,
      { signal, accept: 'application/octet-stream' },
    );
    return readClientDeliveryFile(response, file);
  },
  getMessages(workspaceId: string, ticketId: string, options: { limit?: number; after?: string | null } = {}) {
    return requestJson<ClientTicketPage<ClientTicketMessage>>(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/messages${pageQuery(options)}`,
    );
  },
  reply(workspaceId: string, ticketId: string, input: ClientTicketReplyInput) {
    return withOperationRecovery(
      () => requestJson<ClientTicketReceipt>(
        `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/messages`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
      () => clientTicketApi.getOperation(workspaceId, ticketId, input.operationId),
    );
  },
  async getDocuments(workspaceId: string, ticketId: string) {
    return parseTicketDocumentList(await requestJson<unknown>(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/documents`,
    ));
  },
  async uploadDocument(workspaceId: string, ticketId: string, file: File, replacesDocumentId: string | null, operationId: string) {
    const metadata = { operationId, filename: file.name, contentType: file.type, replacesDocumentId };
    const encoded = encodeURIComponent(JSON.stringify(metadata));
    if (encoded.length > 2048) throw new ClientTicketApiError(400, 'The file name is too long. Rename it and try again.');
    return parseTicketDocument(await requestJson<unknown>(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/documents`,
      { method: 'POST', body: file, headers: {
        'Content-Type': 'application/octet-stream', 'X-Alpha-Ticket-Document': encoded,
      } },
    ));
  },
  async downloadDocument(workspaceId: string, ticketId: string, documentId: string): Promise<Blob> {
    const response = await requestResponse(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/documents/${pathId(documentId)}/content`,
      { accept: 'application/octet-stream' },
    );
    return response.blob();
  },
  decide(workspaceId: string, ticketId: string, input: ClientTicketCommandInput) {
    return withOperationRecovery(
      () => requestJson<ClientTicketReceipt>(
        `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/commands`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
      () => clientTicketApi.getOperation(workspaceId, ticketId, input.operationId),
    );
  },
  getOperation(workspaceId: string, ticketId: string, operationId: string) {
    return requestJson<ClientTicketReceipt>(
      `/workspaces/${pathId(workspaceId)}/tickets/${pathId(ticketId)}/operations/${pathId(operationId)}`,
    );
  },
};

export const clientTicketDocumentsApi: TicketDocumentsApi = {
  list: (workspaceId, ticketId) => clientTicketApi.getDocuments(workspaceId ?? '', ticketId),
  upload: (workspaceId, ticketId, file, replacesDocumentId, operationId) =>
    clientTicketApi.uploadDocument(workspaceId ?? '', ticketId, file, replacesDocumentId, operationId),
  download: (workspaceId, ticketId, documentId) => clientTicketApi.downloadDocument(workspaceId ?? '', ticketId, documentId),
};
