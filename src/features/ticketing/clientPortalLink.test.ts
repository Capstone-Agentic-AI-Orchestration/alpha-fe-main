import { describe, expect, it } from 'vitest';
import { effectivePortalFilter, portalFilterFromHash } from './clientPortalLink';

describe('client portal email deep link', () => {
  it('opens the list filtered to what needs the client', () => {
    expect(portalFilterFromHash('#/client?filter=needs_client')).toBe('needs_client');
  });
  it('ignores everything else', () => {
    for (const hash of ['', '#', '#/client', '#/client?filter=history', '#/client?filter=needs_client&filter=all',
      '#/team?filter=needs_client', '#/client/forgot?filter=needs_client', 'filter=needs_client']) {
      expect(portalFilterFromHash(hash)).toBe('all');
    }
  });
  it('falls back to the full list when the filter is not offered', () => {
    expect(effectivePortalFilter('needs_client', false)).toBe('all');
    expect(effectivePortalFilter('needs_client', true)).toBe('needs_client');
    expect(effectivePortalFilter('open', false)).toBe('open');
  });
});
