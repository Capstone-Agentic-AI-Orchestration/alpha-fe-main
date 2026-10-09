export type AppEntry = 'internal' | 'client-portal' | 'client-activation' | 'public-inquiry-unavailable' | 'preview-client' | 'preview-pm';

function isRoute(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

function hashRoutePath(hash = ''): string {
  if (!hash.startsWith('#/')) return '';
  return hash.slice(1).split('?')[0];
}

/** Select before loading internal state. Preview is never a production login. */
export function selectAppEntry(
  location: { pathname: string; search: string; hostname: string; protocol: string; hash?: string },
  development: boolean,
): AppEntry {
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const browser = ['http:', 'https:'].includes(location.protocol);
  const hashPath = hashRoutePath(location.hash);
  // Public inquiry URLs must never fall through to the internal workspace app,
  // even while the public intake endpoint is deliberately off.
  if (browser && (isRoute(location.pathname, '/request') || isRoute(hashPath, '/request'))) {
    return 'public-inquiry-unavailable';
  }
  // Invitation tokens arrive in the fragment so browsers do not send them to
  // Alpha's web server, access logs, or Referer headers. Keep activation out
  // of the internal workspace app even before provider sign-in is configured.
  if (browser && (isRoute(location.pathname, '/client/activate') || isRoute(hashPath, '/client/activate'))) {
    return 'client-activation';
  }
  const options = new URLSearchParams(location.search).getAll('ticketing-preview');
  if (development && loopback && browser && options.length === 1) {
    if (options[0] === 'client') return 'preview-client';
    if (options[0] === 'pm') return 'preview-pm';
  }
  // Canonical web entry uses /#/client so the existing relative asset base
  // and component-state hosting remain compatible with Electron and Vercel.
  // No new hosting rewrite or global base change is needed for client links.
  if (browser && (isRoute(hashPath, '/client') || isRoute(location.pathname, '/client'))) {
    return 'client-portal';
  }
  return 'internal';
}
