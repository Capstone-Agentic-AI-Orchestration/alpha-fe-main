import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPublicTicketInquirySubmitter, PublicTicketIntakeApiError, publicTicketIntakeApi } from './publicIntakeApi';
import type { PublicTicketInquiryRequest } from './publicIntakeContract';

const request: PublicTicketInquiryRequest = {
  inquiry: {
    schemaVersion: 1,
    operationId: 'operation-1',
    fullName: 'Taylor Client',
    email: 'taylor@example.test',
    company: null,
    title: 'Project inquiry',
    description: 'Please discuss a project.',
    requestedDeadline: null,
  },
};

function browser(protocol = 'https:', hostname = 'alpha.example') {
  vi.stubGlobal('window', { location: { protocol, hostname } });
}

function jsonResponse(status: number, payload: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('public inquiry browser transport', () => {
  it('accepts only the public enabled flag, ignoring unrelated server fields', async () => {
    browser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { enabled: true, testing: true })));
    expect(await publicTicketIntakeApi.configuration('alpha-workspace')).toEqual({ enabled: true });
  });
  it('loads only public intake configuration from the same-origin API', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { enabled: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await publicTicketIntakeApi.configuration('alpha-workspace')).toEqual({ enabled: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/public/ticket-intakes/alpha-workspace/config', expect.objectContaining({ credentials: 'omit', mode: 'same-origin' }));
  });
  it('fails closed when intake configuration is unavailable or malformed', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { enabled: 'true' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await publicTicketIntakeApi.configuration('alpha-workspace')).toEqual({ enabled: false });
    expect(await publicTicketIntakeApi.configuration('alpha-workspace')).toEqual({ enabled: false });
    expect(await publicTicketIntakeApi.configuration('../foreign')).toEqual({ enabled: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('submits same-origin without cookies or internal desktop credentials and exposes only a receipt', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { received: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicTicketIntakeApi.submit('acme-client', request)).resolves.toEqual({ received: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/public/ticket-intakes/acme-client', expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      mode: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify(request),
    }));
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Alpha-Local-Token')).toBeNull();
    expect(options.credentials).toBe('omit');
  });

  it('allows local HTTP only on loopback and still uses same-origin transport', async () => {
    browser('http:', '127.0.0.1');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { received: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicTicketIntakeApi.submit('acme-client', request)).resolves.toEqual({ received: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ mode: 'same-origin', credentials: 'omit' });
  });

  it('connects the form payload to the existing API without a provider token', async () => {
    browser();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { received: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createPublicTicketInquirySubmitter('acme-client')(request.inquiry)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/public/ticket-intakes/acme-client', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ inquiry: request.inquiry }),
    }));
  });

  it('refuses insecure non-loopback origins before making a request', async () => {
    browser('http:', 'alpha.example');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicTicketIntakeApi.submit('acme-client', request)).rejects.toMatchObject({
      status: null,
      message: 'Inquiry submission is available only in a secure web browser or local development.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed inquiry-link slugs locally without making a request', async () => {
    browser();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(publicTicketIntakeApi.submit('../other-tenant', request)).rejects.toMatchObject({
      status: 404,
      code: 'ticket_intake_entry_unavailable',
      message: 'This inquiry link is unavailable.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not accept a success response that leaks ticket identity or status', async () => {
    browser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(202, {
      received: true, ticketId: 'must-not-be-exposed', status: 'received',
    })));

    await expect(publicTicketIntakeApi.submit('acme-client', request)).rejects.toMatchObject({
      status: 202,
      code: 'response_outcome_unknown',
      retryWithSameOperationId: true,
    });
  });

  it('maps server failures to safe copy and preserves only a bounded retry delay', async () => {
    browser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, {
      code: 'ticket_intake_rate_limited', message: 'private server detail',
    }, { 'Retry-After': '30' })));

    await expect(publicTicketIntakeApi.submit('acme-client', request)).rejects.toMatchObject({
      status: 429,
      code: 'ticket_intake_rate_limited',
      message: 'Too many submissions. Please wait before trying again.',
      retryAfterSeconds: 30,
    });
  });

  it('does not expose unknown server errors or payload details to the caller', async () => {
    browser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {
      code: 'database_password_leaked', message: 'private database detail',
    })));

    try {
      await publicTicketIntakeApi.submit('acme-client', request);
      throw new Error('expected submission to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PublicTicketIntakeApiError);
      expect(error).toMatchObject({
        status: 500,
        code: null,
        message: 'The inquiry could not be submitted. Please try again later.',
      });
      expect((error as Error).message).not.toContain('private database detail');
      expect((error as Error).message).not.toContain('database_password_leaked');
    }
  });

  it('marks a network failure as uncertain so the caller can retain the same operation ID', async () => {
    browser();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('internal network detail')));

    await expect(publicTicketIntakeApi.submit('acme-client', request)).rejects.toMatchObject({
      status: null,
      code: 'transport_outcome_unknown',
      retryWithSameOperationId: true,
      message: 'We could not confirm whether this went through. Keep the same submission ID and verify again before retrying.',
    });
  });

  it('bounds a stalled submission and classifies timeout as an uncertain outcome', async () => {
    vi.useFakeTimers();
    browser();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = options.signal as AbortSignal;
      requestSignal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const submissionOutcome = publicTicketIntakeApi.submit('acme-client', request)
      .then(() => ({ error: null as unknown }), error => ({ error }));
    await vi.advanceTimersByTimeAsync(30_000);
    const { error } = await submissionOutcome;
    expect(error).toMatchObject({
      code: 'transport_outcome_unknown',
      retryWithSameOperationId: true,
    });
    expect(requestSignal?.aborted).toBe(true);
  });
});
