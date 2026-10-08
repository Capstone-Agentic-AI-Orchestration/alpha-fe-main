import { useEffect } from 'react';
import alphaMarkUrl from '@/assets/alpha-mark.png';

function invitationTokenState(): 'valid_format' | 'missing' | 'invalid' {
  const hash = window.location.hash;
  const hashRoute = hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '';
  const inHashRoute = hashRoute === '/client/activate';
  const inPathRoute = window.location.pathname === '/client/activate'
    || window.location.pathname.startsWith('/client/activate/');
  if (!inHashRoute && !inPathRoute) return 'missing';

  const query = inHashRoute
    ? hash.slice(1).split('?').slice(1).join('?')
    : window.location.search.slice(1);
  const values = new URLSearchParams(query).getAll('token');
  if (values.length === 0) return 'missing';
  return values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0]) ? 'valid_format' : 'invalid';
}

function removeTokenFromAddressBar(): void {
  const search = new URLSearchParams(window.location.search);
  search.delete('token');
  const searchText = search.toString();
  const [hashRoute = '', hashQuery = ''] = window.location.hash.slice(1).split('?');
  const fragmentParams = new URLSearchParams(hashQuery);
  fragmentParams.delete('token');
  const remainingFragment = fragmentParams.toString();
  const hash = window.location.hash
    ? `#${hashRoute}${remainingFragment ? `?${remainingFragment}` : ''}`
    : '';
  history.replaceState(null, '', `${window.location.pathname}${searchText ? `?${searchText}` : ''}${hash}`);
}

/** Fail-closed destination for invitation links until provider activation is wired. */
export default function ClientActivationUnavailable() {
  const tokenState = invitationTokenState();

  useEffect(() => {
    removeTokenFromAddressBar();
  }, []);

  const hasToken = tokenState === 'valid_format';
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-gray-300">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-surface p-7 shadow-2xl">
        <img src={alphaMarkUrl} alt="Alpha" className="h-10 w-10 object-contain" />
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-300">Alpha · Client access</p>
          <h1 className="text-xl font-semibold text-white">
            {hasToken ? 'Secure activation is not available yet' : 'This invitation link is incomplete'}
          </h1>
          <p className="text-sm leading-relaxed text-gray-400">
            {hasToken
              ? 'Alpha cannot activate client access in this environment yet. No account was created and no project information was opened. Please contact your project manager when client access is ready.'
              : 'Ask your project manager to issue a new invitation. No account was created and no project information was opened.'}
          </p>
        </div>
        <p className="border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-gray-500">
          The one-time link is removed from the address bar. This page does not sign you into the internal Alpha workspace.
        </p>
      </section>
    </main>
  );
}
