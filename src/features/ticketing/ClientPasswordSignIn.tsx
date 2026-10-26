import { useState } from 'react';
import { ArrowUpRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { ClientAuthShell } from './ClientAuthShell';
import { clientAccountApi } from './clientAccountApi';
import { COSMO_IGNITE_EVENT } from './publicClient/cosmoBackdropScene';

/** Let the backdrop's spiral flash once before the portal replaces the page. */
function igniteThen(next: () => void) {
  globalThis.dispatchEvent(new Event(COSMO_IGNITE_EVENT));
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
  return <ClientAuthShell><h2>Sign in to your requests</h2><p className="ca-description">Use the email your project manager invited and the password you chose during account setup.</p>
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
      <a className="ca-link" href="/#/client/forgot">Forgot password?</a>
      <button className="ca-submit" type="submit" disabled={busy || unavailable || !email.trim() || !password}><span className="ca-submit-text">{busy ? 'Signing in…' : 'Sign in'}</span><span className="ca-submit-icon"><ArrowUpRight size={16} /></span></button>
    </form>
    {(failure || error) && <p role="alert" className="ca-error">{failure || error}</p>}
    <p className="ca-notice">First time here? Open your project manager’s invitation to finish account setup. If you already have client access but have not set a password, <a href="/#/client/forgot">use password recovery to set one</a>. Your requests stay with the same account.</p>
    <button className="ca-link" type="button" onClick={onRetry} disabled={busy}><RefreshCw size={12} />Check access again</button>
  </ClientAuthShell>;
}
