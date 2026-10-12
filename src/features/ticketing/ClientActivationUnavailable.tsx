import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';

import alphaMarkUrl from '@/assets/alpha-mark.png';
import { ClientTicketApiError, clientTicketApi, type ClientEmailLinkType } from './clientApi';
import { primary } from './ticketUi';

type LinkPayload = {
  invitationToken: string | null;
  providerTokenHash: string;
  providerTokenType: ClientEmailLinkType;
} | null;

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
    || (providerType[0] !== 'invite' && providerType[0] !== 'magiclink')) return null;
  if (invitation.length === 1 && !/^[A-Za-z0-9_-]{43}$/.test(invitation[0])) return null;
  return {
    invitationToken: invitation[0] ?? null,
    providerTokenHash: providerHash[0],
    providerTokenType: providerType[0],
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

/** Consumes Supabase's one-time email proof, then establishes Alpha's scoped HttpOnly session. */
export default function ClientActivationUnavailable() {
  const [state, setState] = useState<'working' | 'complete' | 'invalid' | 'failed'>('working');
  const [failureMessage, setFailureMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const link = activationLink(window.location);
    // Remove secrets before any network call or subsequent browser navigation.
    history.replaceState(null, '', scrubbedActivationUrl(window.location));
    if (!link) { setState('invalid'); return; }

    const redeem = link.invitationToken
      ? clientTicketApi.activateInvitation(link.invitationToken, link.providerTokenHash, link.providerTokenType)
      : clientTicketApi.createSessionFromEmailLink(link.providerTokenHash, link.providerTokenType);
    redeem.then(() => setState('complete')).catch(error => { setFailureMessage(activationFailureMessage(error)); setState('failed'); });
  }, []);

  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-gray-300">
    <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-surface p-7 shadow-2xl">
      <img src={alphaMarkUrl} alt="Alpha" className="h-10 w-10 object-contain" />
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-300">Alpha · Client access</p>
        <h1 className="text-xl font-semibold text-white">
          {state === 'working' ? 'Verifying your email…' : state === 'complete' ? 'Secure access is ready' : state === 'invalid' ? 'This link is incomplete' : 'This link could not be used'}
        </h1>
        <p role={state === 'failed' || state === 'invalid' ? 'alert' : 'status'} className="text-sm leading-relaxed text-gray-400">
          {state === 'working' ? 'Alpha is checking this one-time link. This may take a moment.'
            : state === 'complete' ? 'You are signed in. Your account can see only the tickets explicitly granted to it.'
              : state === 'invalid' ? 'The link is missing required information. Ask your project manager to send a new invitation, or request a fresh sign-in link.'
                : failureMessage}
        </p>
      </div>
      {state === 'working' && <LoaderCircle size={18} aria-label="Verifying" className="animate-spin text-brand-300" />}
      {state === 'complete' && <button type="button" onClick={() => window.location.replace('/#/client')} className={primary}><CheckCircle2 size={14} />Open My Tickets</button>}
      {(state === 'invalid' || state === 'failed') && <>
        <a href="/#/client" className={primary}>Return to client sign-in</a>
        <div className="flex items-center gap-2 text-xs text-gray-500"><ShieldAlert size={14} />The one-time values have been removed from the address bar. This does not sign you into Alpha’s internal workspace.</div>
      </>}
    </section>
  </main>;
}
