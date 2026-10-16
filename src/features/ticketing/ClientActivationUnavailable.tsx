import { ClientTicketApiError } from './clientApi';
import type { ClientAccountLink } from './clientAccountApi';
import { ClientAccountSetupPage } from './ClientAccountSetupPage';

type LinkPayload = ClientAccountLink | null;

export function activationLink(location: { hash: string; pathname: string; search: string }): LinkPayload {
  const hash = location.hash;
  const hashRoute = hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '';
  const inHashRoute = hashRoute === '/client/activate';
  const inPathRoute = location.pathname === '/client/activate'
    || location.pathname.startsWith('/client/activate/');
  if (!inHashRoute && !inPathRoute) return null;

  const query = inHashRoute ? hash.slice(1).split('?').slice(1).join('?') : location.search.slice(1);
  const params = new URLSearchParams(query);
  const invitation = params.getAll('token');
  const providerHash = params.getAll('providerTokenHash');
  const providerType = params.getAll('providerTokenType');
  if (invitation.length > 1 || providerHash.length !== 1 || providerType.length !== 1
    || !/^[A-Za-z0-9_-]{20,256}$/.test(providerHash[0])
    || !['invite', 'magiclink', 'recovery'].includes(providerType[0])) return null;
  if (invitation.length === 1 && !/^[A-Za-z0-9_-]{43}$/.test(invitation[0])) return null;
  return {
    invitationToken: invitation[0] ?? null,
    providerTokenHash: providerHash[0],
    providerTokenType: providerType[0] as ClientAccountLink['providerTokenType'],
  };
}

export function scrubbedActivationUrl(location: { pathname: string; search: string; hash: string }): string {
  const search = new URLSearchParams(location.search);
  for (const key of ['token', 'providerTokenHash', 'providerTokenType', 'type']) search.delete(key);
  const searchText = search.toString();
  const hash = location.hash;
  const hashRoute = hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '';
  const hashQuery = hash.startsWith('#/') ? hash.slice(1).split('?').slice(1).join('?') : '';
  const fragment = new URLSearchParams(hashQuery);
  for (const key of ['token', 'providerTokenHash', 'providerTokenType', 'type']) fragment.delete(key);
  const fragmentText = fragment.toString();
  const cleanHash = hashRoute
    ? `#${hashRoute}${fragmentText ? `?${fragmentText}` : ''}`
    : hash;
  return `${location.pathname}${searchText ? `?${searchText}` : ''}${cleanHash}`;
}

export function activationFailureMessage(error: unknown): string {
  if (error instanceof ClientTicketApiError && (error.status === null || error.status >= 500)) {
    return 'Client access could not be reached or is not configured. Contact your project manager. If activation succeeded before the connection ended, a fresh sign-in link will let you continue.';
  }
  if (error instanceof ClientTicketApiError && error.status === 429) return 'Too many attempts. Wait before requesting a fresh link.';
  return 'The link may have expired or already been used. Request a new sign-in link, or ask your project manager to reissue the invitation.';
}

/** Existing invitation URLs now enter the resumable password setup flow. */
export default function ClientActivationUnavailable() {
  return <ClientAccountSetupPage readLink={activationLink} cleanUrl={scrubbedActivationUrl} />;
}
