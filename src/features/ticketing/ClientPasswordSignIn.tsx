import { useState } from 'react';
import { ArrowUpRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { ClientAuthShell } from './ClientAuthShell';
import { clientAccountApi } from './clientAccountApi';
import { BRAND_IGNITE_EVENT } from './publicClient/brandBackdropScene';

/** Let the backdrop's mark flash once before the portal replaces the page. */
function igniteThen(next: () => void) {
  globalThis.dispatchEvent(new Event(BRAND_IGNITE_EVENT));
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  globalThis.setTimeout(next, reduced ? 0 : 380);
}

export function ClientPasswordSignIn({ unavailable, error, onRetry, onSignedIn }: {
  unavailable: boolean; error: string; onRetry: () => void; onSignedIn: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  return <ClientAuthShell><h2>Sign in</h2>
    <form onSubmit={event => {
      event.preventDefault(); if (busy || unavailable) return;
      setBusy(true); setFailure('');
      void clientAccountApi.signIn(email.trim(), password).then(() => igniteThen(onSignedIn)).catch(err => setFailure(err instanceof TypeError
        ? 'We could not connect to sign-in. Check your internet connection and try again.'
        : err instanceof Error ? err.message : 'Could not sign in. Try again.'))
        .finally(() => { setBusy(false); setPassword(''); });
    }}>
      <label className="ca-field"><span>Email address</span><input type="email" required maxLength={254} autoComplete="username" value={email} onChange={event => { setEmail(event.target.value); setFailure(''); }} disabled={busy || unavailable} placeholder="you@example.com" /></label>
      <label className="ca-field"><span>Password</span><div className="ca-password"><input type={visible ? 'text' : 'password'} required maxLength={128} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setFailure(''); }} disabled={busy || unavailable} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <a className="ca-link" href="/#/client/forgot">Forgot or need a password?</a>
      <button className="ca-submit" type="submit" disabled={busy || unavailable || !email.trim() || !password}><span className="ca-submit-text">{busy ? 'Signing in…' : 'Sign in'}</span><span className="ca-submit-icon"><ArrowUpRight size={16} /></span></button>
    </form>
    {(failure || error) && <p role="alert" className="ca-error">{failure || error}</p>}
    {(unavailable || error) && <button className="ca-link" type="button" onClick={onRetry} disabled={busy}><RefreshCw size={12} />Check access again</button>}
  </ClientAuthShell>;
}
