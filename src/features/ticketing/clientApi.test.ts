import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClientTicketApiError, clientTicketApi } from './clientApi';

const csrf = 'a'.repeat(43);

function browser(protocol = 'https:', hostname = 'alpha.example', cookie = `alpha_client_csrf=${csrf}`) {
  vi.stubGlobal('window', { location: { protocol, hostname } });
  vi.stubGlobal('document', { cookie });
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('client browser transport', () => {
  it('loads workflow capabilities from the isolated same-origin client API', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { phaseWorkflowEnabled: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientTicketApi.getWorkflowCapabilities()).resolves.toEqual({ phaseWorkflowEnabled: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/client/workflow-capabilities', expect.objectContaining({
      credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'error',
    }));
  });

  it('bounds a stalled sign-in request and does not automatically redeem a one-time proof again', async () => {
    browser();
    const timeout = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const outcome = clientTicketApi.activateInvitation('a'.repeat(43), 'b'.repeat(32), 'invite')
      .catch(error => error);
    timeout.abort();
    expect(await outcome).toMatchObject({ status: null, reconciliationRequired: true });
    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('redeems PM invitation proofs only through the isolated client API, with no standalone email sign-in calls', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { activated: true }));
    vi.stubGlobal('fetch', fetchMock);
    await clientTicketApi.activateInvitation('a'.repeat(43), 'b'.repeat(32), 'invite');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/client/auth/activate']);
    expect(clientTicketApi).not.toHaveProperty('requestSignInLink');
    expect(clientTicketApi).not.toHaveProperty('createSessionFromEmailLink');
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ credentials: 'same-origin', mode: 'same-origin', referrerPolicy: 'no-referrer' });
      const headers = new Headers(options.headers);
      expect(headers.get('Authorization')).toBeNull();
      expect(headers.get('X-CSRF-Token')).toBeNull();
      expect(headers.get('X-Alpha-Local-Token')).toBeNull();
    }
  });
  it('loads only the requested delivery manifest through the isolated same-origin transport', async () => {
    browser(); const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      deliveryId: 'delivery/a', scopeVersionId: 'scope-a', files: [
        { id: 'file-a', filename: 'result.txt', mediaType: 'text/plain', byteLength: 4, sha256: 'a'.repeat(64) },
      ],
    })); vi.stubGlobal('fetch', fetchMock);
    await clientTicketApi.getDelivery('workspace/a', 'ticket/a', 'delivery/a');
    expect(fetchMock).toHaveBeenCalledWith('/api/client/workspaces/workspace%2Fa/tickets/ticket%2Fa/deliveries/delivery%2Fa',
      expect.objectContaining({ credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store' }));
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get('Authorization')).toBeNull(); expect(headers.get('X-Alpha-Local-Token')).toBeNull();
  });

  it('refuses a file download over an insecure non-loopback origin', async () => {
    browser('http:', 'alpha.example'); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(clientTicketApi.getDeliveryFile('ws', 'ticket', 'delivery',
      { id: 'file', filename: 'result.txt', mediaType: 'text/plain', byteLength: 4, sha256: 'a'.repeat(64) })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks downloaded bytes against the manifest without using server URLs or names', async () => {
    browser(); const data = new TextEncoder().encode('done');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(value => value.toString(16).padStart(2, '0')).join('');
    const fetchMock = vi.fn().mockResolvedValue(new Response(data, { headers: {
      'Content-Type': 'application/octet-stream', 'Content-Length': '4', 'Content-Disposition': 'attachment; filename="ignored.txt"',
    } })); vi.stubGlobal('fetch', fetchMock);
    const result = await clientTicketApi.getDeliveryFile('workspace/a', 'ticket/a', 'delivery/a',
      { id: 'file/a', filename: 'result.txt', mediaType: 'text/plain', byteLength: 4, sha256 });
    expect(await result.text()).toBe('done');
    expect(fetchMock).toHaveBeenCalledWith('/api/client/workspaces/workspace%2Fa/tickets/ticket%2Fa/deliveries/delivery%2Fa/files/file%2Fa',
      expect.objectContaining({ credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store' }));
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Accept')).toBe('application/octet-stream');
  });

  it('refuses insecure non-loopback origins before making a request', async () => {
    browser('http:', 'alpha.example');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientTicketApi.getSession()).rejects.toMatchObject({
      status: null,
      message: 'For your safety, open Alphaexplora in its secure website to access your requests.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses same-origin, no-store browser requests without internal desktop credentials', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { authenticated: false }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientTicketApi.getSession()).resolves.toEqual({ authenticated: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/client/session', expect.objectContaining({
      credentials: 'same-origin', mode: 'same-origin', cache: 'no-store',
      redirect: 'error', referrerPolicy: 'no-referrer',
    }));
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Alpha-Local-Token')).toBeNull();
  });

  it('requires exactly one valid CSRF cookie for writes', async () => {
    browser('https:', 'alpha.example', `alpha_client_csrf=${csrf}; alpha_client_csrf=${csrf}`);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientTicketApi.signOut()).rejects.toBeInstanceOf(ClientTicketApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the CSRF token but no bearer credential on a client reply', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      ticketId: 'ticket-1', operationId: 'operation-1', version: 2, status: 'under_review', messageId: 'message-1',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await clientTicketApi.reply('workspace-1', 'ticket-1', {
      schemaVersion: 1, operationId: 'operation-1', expectedVersion: 1, body: 'Please clarify this item.',
    });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('X-CSRF-Token')).toBe(csrf);
    expect(headers.get('Authorization')).toBeNull();
    expect(options.credentials).toBe('same-origin');
    expect(options.mode).toBe('same-origin');
  });

  it('creates a request on the matching client ticket endpoint with its approved intake context', async () => {
    browser();
    const receipt = { ticketId: 'ticket-1', operationId: 'operation-1', version: 1, status: 'received', reference: 'T-1' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, receipt));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      intakeContextId: 'context-1', schemaVersion: 1 as const, operationId: 'operation-1',
      title: 'A client request', description: 'Please review this requested change.',
      projectPreference: { kind: 'not_sure' as const }, requestedDeadline: null,
    };

    await expect(clientTicketApi.createTicket(input)).resolves.toEqual(receipt);
    expect(fetchMock).toHaveBeenCalledWith('/api/client/tickets', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'error',
      body: JSON.stringify(input),
    }));
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('X-CSRF-Token')).toBe(csrf);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Alpha-Local-Token')).toBeNull();
  });

  it('loads project eligibility from the authenticated project endpoint without resolving projects by display name', async () => {
    browser();
    const project = { workspaceId: 'workspace/one', projectId: 'project/one', name: 'Same display name',
      updatedAt: '2026-10-26T08:00:00Z', intakeOptionId: 'opaque-option-1', preview: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [project] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientTicketApi.listProjects()).resolves.toEqual({ items: [project] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/client/projects');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', mode: 'same-origin' });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [{ ...project, intakeOptionId: undefined }] }));
    await expect(clientTicketApi.listProjects()).rejects.toThrow('shared projects could not be read');
  });

  it('uses global and exact workspace/project request endpoints for the client project portal', async () => {
    browser();
    const item = { id: 'ticket-1', reference: 'REQ-1', title: 'A request', status: 'received',
      createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-26T00:00:00Z', closedAt: null,
      readOnly: false, writesAvailable: true, requestedAction: null, workspaceId: 'workspace/one',
      projectId: null, projectName: null, projectLinkStatus: 'pending_review', requestedProjectName: 'Portal', };
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(200, { items: [item], nextCursor: null,
      counters: { kind: 'client', open: 1, needsClient: 0 } }));
    vi.stubGlobal('fetch', fetchMock);

    await clientTicketApi.listRequests({ limit: 25, after: 'cursor/one', search: 'new request', filter: 'open' });
    await clientTicketApi.listProjectRequests('workspace/one', 'project/one', { limit: 20, search: 'update' });
    await clientTicketApi.getProjectFeedbackMessages('workspace/one', 'project/one', { limit: 20, before: 'message/one' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/client/requests?limit=25&after=cursor%2Fone&search=new+request&filter=open',
      '/api/client/projects/workspace%2Fone/project%2Fone/requests?limit=20&search=update',
      '/api/client/projects/workspace%2Fone/project%2Fone/preview/messages?limit=20&before=message%2Fone',
    ]);
  });

  it('recovers an uncertain project feedback send using the same operation ID and body', async () => {
    browser();
    const receipt = { messageId: 'feedback-1', operationId: 'feedback-operation-1' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503, { code: 'project_message_outcome_unknown', reconciliationRequired: true }))
      .mockResolvedValueOnce(jsonResponse(200, receipt));
    vi.stubGlobal('fetch', fetchMock);
    const input = { schemaVersion: 1 as const, operationId: 'feedback-operation-1', body: 'The preview looks good.' };

    await expect(clientTicketApi.sendProjectFeedbackMessage('workspace/one', 'project/one', input)).resolves.toEqual(receipt);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/client/projects/workspace%2Fone/project%2Fone/preview/messages',
      '/api/client/projects/workspace%2Fone/project%2Fone/preview/messages/operations/feedback-operation-1',
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify(input) });
  });

  it('recovers an uncertain ticket creation with its original intake context and operation ID', async () => {
    browser();
    const receipt = {
      ticketId: 'ticket-created', operationId: 'create-operation-stable', version: 0,
      status: 'received', reference: 'REQ-42',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503, {
        code: 'transaction_outcome_unknown', reconciliationRequired: true,
      }))
      .mockResolvedValueOnce(jsonResponse(200, receipt));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      intakeContextId: 'intake-context-a', schemaVersion: 1 as const,
      operationId: 'create-operation-stable', title: 'Request a change',
      description: 'Please review this requested change.',
    };

    await expect(clientTicketApi.createTicket(input)).resolves.toEqual(receipt);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/client/tickets');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify(input) });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/client/tickets/operations/create-operation-stable?intakeContextId=intake-context-a',
    );
    const lookupOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(lookupOptions.method).toBeUndefined();
    expect(lookupOptions.credentials).toBe('same-origin');
  });

  it('reconciles an uncertain reply using the same operation ID and payload', async () => {
    browser();
    const receipt = {
      ticketId: 'ticket-1', operationId: 'operation-stable', version: 2,
      status: 'under_review', messageId: 'message-1',
    };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('connection interrupted'))
      .mockResolvedValueOnce(jsonResponse(404, { code: 'ticket_not_found' }))
      .mockResolvedValueOnce(jsonResponse(200, receipt));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientTicketApi.reply('workspace-1', 'ticket-1', {
      schemaVersion: 1, operationId: 'operation-stable', expectedVersion: 1, body: 'Same request after reconnect.',
    })).resolves.toEqual(receipt);

    const writes = fetchMock.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === 'POST');
    expect(writes).toHaveLength(2);
    expect(writes[0]?.[0]).toBe(writes[1]?.[0]);
    expect((writes[0]?.[1] as RequestInit).body).toBe((writes[1]?.[1] as RequestInit).body);
    expect(JSON.parse((writes[1]?.[1] as RequestInit).body as string).operationId).toBe('operation-stable');
  });
});
