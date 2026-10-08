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

afterEach(() => vi.unstubAllGlobals());

describe('client browser transport', () => {
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
      message: 'Client access is available only in a secure web browser or on local development.',
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
