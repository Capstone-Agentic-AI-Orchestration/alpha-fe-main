import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClientLandingPage from '@/features/landing/ClientLandingPage';
import { ClientPasswordSignIn } from './ClientPasswordSignIn';
import ClientPasswordRecovery from './ClientPasswordRecovery';
import { activationLink, scrubbedActivationUrl } from './ClientActivationUnavailable';
import { clientAccountApi } from './clientAccountApi';

afterEach(() => { vi.unstubAllGlobals(); });
function browser() {
  vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'alpha.example.test', hash: '#/?intake=team-a', search: '' } });
}
describe('client landing and password entry', () => {
  it('preserves the workspace destination and provides separate client/staff entry', () => {
    browser(); const html = renderToStaticMarkup(<ClientLandingPage />);
    expect(html).toContain('/#/request?intake=team-a');
    expect(html).toContain('/#/client?intake=team-a');
    expect(html).toContain('href="/#/team"');
    expect(html).toContain('illustrative view of the client journey');
    expect(html).not.toContain('TBD');
    expect(html).not.toContain('<form');
  });
  it('shows password sign-in and existing-account migration without open signup or client GitHub login', () => {
    browser(); const html = renderToStaticMarkup(<ClientPasswordSignIn unavailable={false} error="" onRetry={() => {}} onSignedIn={() => {}} />);
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('/#/client/forgot');
    expect(html).toContain('Set up your password');
    expect(html).not.toContain('Continue with GitHub');
    expect(html).not.toContain('30 days');
    expect(html).not.toContain('/sign-up');
  });
  it('explains password recovery without sending another inquiry or promising account existence', () => {
    const html = renderToStaticMarkup(<ClientPasswordRecovery />);
    expect(html).toContain('Your account and existing requests will stay together');
    expect(html).toContain('Your PM must first invite you');
  });
  it('recognizes recovery links and removes credentials before navigation', () => {
    const location = { pathname: '/', search: '', hash: `#/client/activate?providerTokenHash=${'a'.repeat(32)}&providerTokenType=recovery` };
    expect(activationLink(location)?.providerTokenType).toBe('recovery');
    expect(scrubbedActivationUrl(location)).toBe('/#/client/activate');
    expect(activationLink({ ...location, hash: `${location.hash}&providerTokenType=invite` })).toBeNull();
  });
  it('uses same-origin password transport without attaching the internal token or requiring a prior client CSRF cookie', async () => {
    browser();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await clientAccountApi.signIn('client@example.test', 'valid-password');
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/client/auth/sign-in');
    expect(options.credentials).toBe('same-origin');
    expect(options.cache).toBe('no-store');
    expect(new Headers(options.headers).has('Authorization')).toBe(false);
    expect(new Headers(options.headers).has('X-CSRF-Token')).toBe(false);
  });
  it('keeps invitation proof in the request body and resumes setup with a cookie-backed GET', async () => {
    browser(); const view = { email: 'client@example.test', action: 'set_password', expiresAt: new Date(Date.now() + 60000).toISOString() };
    const fetch = vi.fn(async () => new Response(JSON.stringify(view), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const proof = 'a'.repeat(32);
    expect(await clientAccountApi.begin({ invitationToken: null, providerTokenHash: proof, providerTokenType: 'magiclink' })).toEqual(view);
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[0]).not.toContain(proof);
    expect(await clientAccountApi.setup()).toEqual(view);
  });
  it('requires the dedicated setup CSRF cookie to save a password', async () => {
    browser(); vi.stubGlobal('document', { cookie: '' });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(clientAccountApi.complete('valid-password')).rejects.toThrow('Refresh');
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal('document', { cookie: `alpha_client_setup_csrf=${'c'.repeat(43)}` });
    await clientAccountApi.complete('valid-password');
    const options = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('c'.repeat(43));
  });
});
