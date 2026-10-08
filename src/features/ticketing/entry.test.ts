import { describe, expect, it } from 'vitest';
import { selectAppEntry } from './entry';

const location = { pathname: '/', search: '', hostname: 'localhost', protocol: 'http:' };
describe('isolated ticket application entry', () => {
  it.each(['client', 'pm'] as const)('allows the %s rehearsal only on a development loopback browser', role => {
    expect(selectAppEntry({ ...location, search: `?ticketing-preview=${role}` }, true)).toBe(`preview-${role}`);
    expect(selectAppEntry({ ...location, search: `?ticketing-preview=${role}` }, false)).toBe('internal');
  });
  it.each(['alpha.example.com', 'localhost.example.com', '10.0.0.1'])('rejects rehearsal on %s', hostname => {
    expect(selectAppEntry({ ...location, hostname, search: '?ticketing-preview=pm' }, true)).toBe('internal');
  });
  it('never opens rehearsal from a packaged file renderer or ambiguous query', () => {
    expect(selectAppEntry({ ...location, protocol: 'file:', search: '?ticketing-preview=client' }, true)).toBe('internal');
    expect(selectAppEntry({ ...location, search: '?ticketing-preview=client&ticketing-preview=pm' }, true)).toBe('internal');
    expect(selectAppEntry({ ...location, search: '?ticketing-preview=admin' }, true)).toBe('internal');
  });
  it.each(['/client', '/client/', '/client/tickets/ticket-id', '/client/auth/complete'])('keeps %s outside the internal application in production', pathname => {
    expect(selectAppEntry({ ...location, pathname }, false)).toBe('client-portal');
    expect(selectAppEntry({ ...location, pathname, search: '?ticketing-preview=pm' }, false)).toBe('client-portal');
  });
  it.each([
    ['/client/activate', ''],
    ['/', '#/client/activate?token=opaque'],
  ])('routes invitation activation %s %s to its isolated entry', (pathname, hash) => {
    expect(selectAppEntry({ ...location, pathname, hash }, false)).toBe('client-activation');
  });
  it.each(['/', '/projects', '/clientele', '/clients'])('preserves the internal entry at %s', pathname => {
    expect(selectAppEntry({ ...location, pathname }, false)).toBe('internal');
  });
  it.each(['#/client', '#/client/', '#/client/tickets/ticket-id'])('supports a client link at the existing single-page web URL: %s', hash => {
    expect(selectAppEntry({ ...location, hash }, false)).toBe('client-portal');
    expect(selectAppEntry({ ...location, hash, protocol: 'file:' }, false)).toBe('internal');
  });
  it.each(['#alpha_error=oauth_failed', '#/clientele', '#/projects'])('does not intercept an existing/internal fragment: %s', hash => {
    expect(selectAppEntry({ ...location, hash }, false)).toBe('internal');
  });
});
