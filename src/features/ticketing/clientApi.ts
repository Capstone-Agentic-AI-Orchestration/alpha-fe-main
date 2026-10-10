import { parseClientDeliveryFile, parseClientDeliveryManifest, readClientDeliveryFile, type ClientDeliveryFile } from './clientDelivery';
import { ClientTicketApiError } from './clientApiError';
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
export interface ClientTicketDetail extends ClientTicketQueueItem {
  description: string;
  companyLabel: string;
  version: number;
  sharedProjectName: string | null;
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
export interface ClientTicketReceipt {
  ticketId: string; operationId: string; version: number; status: ClientTicketStatus;
  reference?: string; messageId?: string;
}
export interface ClientSession { authenticated: boolean; expiresAt?: string }
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
  if (status === 403) return 'This request could not be verified or is not allowed.';
  if (status === 404) return 'This ticket or invitation is unavailable.';
  if (status === 409) return 'The ticket changed or this action was already handled. Refresh and review it.';
  if (status === 429) return 'Too many attempts. Try again later.';
  if (status >= 500) return 'The client service is temporarily unavailable. Try again later.';
  return 'The request could not be completed. Check the information and try again.';
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

async function withOperationRecovery(
  submit: () => Promise<ClientTicketReceipt>,
  lookup: () => Promise<ClientTicketReceipt>,
): Promise<ClientTicketReceipt> {
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
    throw new ClientTicketApiError(null, 'Client access is available only in a secure web browser or on local development.');
  }
  const { csrf: csrfOverride, accept = 'application/json', ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
  const csrfRequired = csrfOverride ?? !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = new Headers(options.headers);
  headers.set('Accept', accept);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (csrfRequired) headers.set('X-CSRF-Token', csrfToken());

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...fetchOptions,
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
        : 'Could not reach the client service. Check your connection and try again.',
      writeOutcomeUnknown ? 'transport_outcome_unknown' : null,
      writeOutcomeUnknown,
    );
  }
  if (!response.ok) throw await apiError(response);
  return response;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestResponse(path, options);
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ClientTicketApiError(response.status, 'The client service returned an unreadable response.'); }
}

function pathId(value: string): string { return encodeURIComponent(value); }
function pageQuery(options: { limit?: number; after?: string | null }): string {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.after) query.set('after', options.after);
  const value = query.toString();
  return value ? `?${value}` : '';
}

/** Client-only HTTP facade; provider tokens are exchanged immediately and never persisted. */
export const clientTicketApi = {
  requestSignInLink(email: string) {
    return requestJson<{ accepted: true; message: string }>('/auth/sign-in-link', {
      method: 'POST', csrf: false, body: JSON.stringify({ email }),
    });
  },
  activateInvitation(invitationToken: string, providerTokenHash: string, providerTokenType: ClientEmailLinkType) {
    return requestJson<{ activated: true }>('/auth/activate', {
      method: 'POST', csrf: false,
      body: JSON.stringify({ invitationToken, providerTokenHash, providerTokenType }),
    });
  },
  createSessionFromEmailLink(providerTokenHash: string, providerTokenType: ClientEmailLinkType) {
    return requestJson<{ authenticated: true; expiresAt: string }>('/auth/session', {
      method: 'POST', csrf: false,
      body: JSON.stringify({ providerTokenHash, providerTokenType }),
    });
  },
  getSession() { return requestJson<ClientSession>('/session'); },
  signOut() { return requestJson<void>('/session/logout', { method: 'POST', body: '{}' }); },
  listWorkspaces() {
    return requestJson<{ items: ClientWorkspaceOption[] }>('/workspaces');
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
