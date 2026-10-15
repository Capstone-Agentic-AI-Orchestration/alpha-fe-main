import type {
  PublicTicketInquiryPayload, PublicTicketInquiryRequest, PublicTicketInquiryResponse,
} from './publicIntakeContract';

const API_ROOT = '/api/public/ticket-intakes';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PUBLIC_INTAKE_TIMEOUT_MS = 30_000;
const INTAKE_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
export type PublicInquiryContext = { kind: 'central' } | { kind: 'workspace'; slug: string } | { kind: 'invalid' };

/** Routing context only: the server still resolves and authorizes the intake. */
export function publicInquiryContext(location: { hash?: string; search?: string }): PublicInquiryContext {
  const hashQuery = location.hash?.startsWith('#/') ? location.hash.split('?').slice(1).join('?') : '';
  const hashValues = new URLSearchParams(hashQuery).getAll('intake');
  const searchValues = new URLSearchParams(location.search ?? '').getAll('intake');
  // Never silently pick one workspace when a URL supplies conflicting context.
  const values = [...hashValues, ...searchValues];
  if (values.length === 0) return { kind: 'central' };
  if (values.length !== 1 || !INTAKE_SLUG.test(values[0])) return { kind: 'invalid' };
  return { kind: 'workspace', slug: values[0] };
}

export function publicInquirySlug(location: { hash?: string; search?: string }): string {
  const context = publicInquiryContext(location);
  return context.kind === 'workspace' ? context.slug : '';
}

export function publicInquiryHref(slug: string): string {
  return INTAKE_SLUG.test(slug) ? `/#/request?${new URLSearchParams({ intake: slug })}` : '/#/request';
}

export function clientPortalHref(slug: string): string {
  return INTAKE_SLUG.test(slug) ? `/#/client?${new URLSearchParams({ intake: slug })}` : '/#/client';
}

export function clientLandingHref(slug: string): string {
  return INTAKE_SLUG.test(slug) ? `/#/?${new URLSearchParams({ intake: slug })}` : '/#/';
}

export class PublicTicketIntakeApiError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
    readonly code: string | null = null,
    readonly retryAfterSeconds: number | null = null,
    readonly retryWithSameOperationId = false,
  ) {
    super(message);
    this.name = 'PublicTicketIntakeApiError';
  }
}

function browserOriginAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'https:') return true;
  return window.location.protocol === 'http:' && LOOPBACK_HOSTS.has(window.location.hostname);
}

function safeFailure(code: unknown, status: number): { code: string | null; message: string; retrySame: boolean } {
  if (typeof code !== 'string' || !/^ticket_intake_[a-z_]{1,48}$/.test(code)) {
    return { code: null, message: 'The inquiry could not be submitted. Please try again later.', retrySame: false };
  }
  const messages: Record<string, { message: string; retrySame?: boolean }> = {
    ticket_intake_entry_unavailable: { message: 'This inquiry link is unavailable.' },
    ticket_intake_writes_disabled: { message: 'Inquiry submission is temporarily unavailable.' },
    ticket_intake_not_verified: { message: 'This inquiry could not be accepted from this page.' },
    ticket_intake_rate_limited: { message: 'Too many submissions. Please wait before trying again.' },
    ticket_intake_operation_conflict: { message: 'The submission changed. Start a new inquiry.' },
    ticket_intake_invalid_request: { message: 'Check the inquiry fields and try again.' },
    ticket_intake_outcome_unknown: {
      message: 'We could not confirm whether this went through. Keep the same submission ID and verify again before retrying.',
      retrySame: true,
    },
    ticket_intake_unavailable: { message: 'Inquiry submission is temporarily unavailable.' },
  };
  const safe = messages[code];
  return safe
    ? { code, message: safe.message, retrySame: safe.retrySame === true }
    : { code: null, message: status >= 500 ? 'Inquiry submission is temporarily unavailable.' : 'The inquiry could not be submitted.', retrySame: false };
}

/** Anonymous intake transport; it never uses the internal API/desktop token or client session. */
export const publicTicketIntakeApi = {
  async centralConfiguration(): Promise<{ enabled: boolean }> {
    if (!browserOriginAllowed()) return { enabled: false };
    const response = await fetch(`${API_ROOT}/config`, {
      credentials: 'omit', mode: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(PUBLIC_INTAKE_TIMEOUT_MS),
    });
    if (!response.ok) return { enabled: false };
    const value = await response.json();
    return value?.enabled === true ? { enabled: true } : { enabled: false };
  },
  async configuration(slug: string): Promise<{ enabled: boolean }> {
    if (!browserOriginAllowed() || !INTAKE_SLUG.test(slug)) {
      return { enabled: false };
    }
    const response = await fetch(`${API_ROOT}/${encodeURIComponent(slug)}/config`, {
      credentials: 'omit', mode: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(PUBLIC_INTAKE_TIMEOUT_MS),
    });
    if (!response.ok) return { enabled: false };
    const value = await response.json();
    return value?.enabled === true ? { enabled: true } : { enabled: false };
  },
  async submit(slug: string, request: PublicTicketInquiryRequest): Promise<PublicTicketInquiryResponse> {
    if (!browserOriginAllowed()) {
      throw new PublicTicketIntakeApiError(null, 'Inquiry submission is available only in a secure web browser or local development.');
    }
    if (slug !== '' && !INTAKE_SLUG.test(slug)) {
      throw new PublicTicketIntakeApiError(404, 'This inquiry link is unavailable.', 'ticket_intake_entry_unavailable');
    }
    const endpoint = slug ? `${API_ROOT}/${encodeURIComponent(slug)}` : API_ROOT;

    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUBLIC_INTAKE_TIMEOUT_MS);
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        credentials: 'omit',
        mode: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
    } catch {
      throw new PublicTicketIntakeApiError(
        null,
        'We could not confirm whether this went through. Keep the same submission ID and verify again before retrying.',
        'transport_outcome_unknown', null, true,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      const value = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown> : null;
      const failure = safeFailure(value?.code, response.status);
      const retryAfterValue = Number(response.headers.get('Retry-After'));
      const retryAfterSeconds = response.status === 429 && Number.isSafeInteger(retryAfterValue)
        && retryAfterValue > 0 && retryAfterValue <= 86400 ? retryAfterValue : null;
      throw new PublicTicketIntakeApiError(
        response.status, failure.message, failure.code, retryAfterSeconds, failure.retrySame,
      );
    }

    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      && (payload as Record<string, unknown>).received === true
      && Object.keys(payload as Record<string, unknown>).length === 1) {
      return { received: true };
    }
    throw new PublicTicketIntakeApiError(
      response.status, 'We could not confirm whether this went through. Keep the same submission ID and verify again before retrying.',
      'response_outcome_unknown', null, true,
    );
  },
  async submitCentral(request: PublicTicketInquiryRequest): Promise<PublicTicketInquiryResponse> {
    return publicTicketIntakeApi.submit('', request);
  },
};

/** Bind the browser API to a server-owned public inquiry slug. */
export function createPublicTicketInquirySubmitter(
  slug: string,
): (inquiry: PublicTicketInquiryPayload) => Promise<void> {
  return async inquiry => {
    await publicTicketIntakeApi.submit(slug, { inquiry });
  };
}
