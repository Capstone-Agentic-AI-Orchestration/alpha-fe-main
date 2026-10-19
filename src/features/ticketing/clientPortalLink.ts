/** Deep links in client emails: /#/client?filter=needs_client opens the list already narrowed to what needs the client. */
export type PortalFilterFromLink = 'all' | 'needs_client';

export function portalFilterFromHash(hash: string): PortalFilterFromLink {
  if (!hash.startsWith('#/')) return 'all';
  const [route, ...query] = hash.slice(1).split('?');
  if (route !== '/client') return 'all';
  const values = new URLSearchParams(query.join('?')).getAll('filter');
  return values.length === 1 && values[0] === 'needs_client' ? 'needs_client' : 'all';
}

/** A filter the portal cannot offer yet (or at all) falls back to the full list. */
export function effectivePortalFilter(filter: string, needsClientAvailable: boolean): string {
  return filter === 'needs_client' && !needsClientAvailable ? 'all' : filter;
}
