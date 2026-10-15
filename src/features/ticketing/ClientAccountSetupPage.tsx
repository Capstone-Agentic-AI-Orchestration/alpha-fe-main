import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { ClientAuthShell } from './ClientAuthShell';
import { clientAccountApi, type ClientAccountLink, type ClientAccountSetup } from './clientAccountApi';

interface LinkLocation { hash: string; search: string; pathname: string }
const defaultFailureMessage = () => 'This link is incomplete, expired, or already used. Request password recovery if your account is active, or ask your PM for a fresh invitation.';

export function ClientAccountSetupPage({ readLink, cleanUrl, failureMessage = defaultFailureMessage }: {
  readLink: (location: LinkLocation) => ClientAccountLink | null;
  cleanUrl: (location: LinkLocation) => string;
  failureMessage?: (error: unknown) => string;
}) {
  const [setup, setSetup] = useState<ClientAccountSetup | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const proof = readLink(window.location);
    history.replaceState(null, '', cleanUrl(window.location));
    const pending = proof ? clientAccountApi.begin(proof) : clientAccountApi.setup();
    void pending.then(setSetup).catch(error => setError(failureMessage(error))).finally(() => setChecking(false));
  }, [readLink, cleanUrl, failureMessage]);
  const existing = setup?.action === 'sign_in';
  return <ClientAuthShell><h2>{complete ? 'Your portal is ready.' : checking ? 'Verifying your email…' : existing ? 'Accept your invitation.' : setup?.action === 'reset_password' ? 'Choose your password.' : 'Finish your account setup.'}</h2>
    <p className="ca-description">{complete ? 'Your authorized requests are together in your client portal.' : existing ? 'This email already has a password. Sign in to finish, keeping your existing account.' : 'Your email comes from the verified invitation or recovery link. Choose a password so you can sign in directly next time.'}</p>
    {setup && !complete && <form onSubmit={event => {
      event.preventDefault(); if (busy) return;
      if (!existing && password !== confirm) { setError('The passwords do not match.'); return; }
      setError(''); setBusy(true);
      void clientAccountApi.complete(password).then(() => setComplete(true)).catch(err => {
        // A previous client's cookie cannot prove this invitation was completed.
        setError(err instanceof Error ? err.message : 'Could not confirm setup. Try again, or return to sign in with the password you chose.');
      }).finally(() => { setBusy(false); setPassword(''); setConfirm(''); });
    }}>
      <label className="ca-field"><span>Invited email</span><input type="email" value={setup.email} readOnly autoComplete="username" className="ca-readonly" /></label>
      <label className="ca-field"><span>{existing ? 'Your password' : 'Choose a password'}</span><div className="ca-password"><input type={visible ? 'text' : 'password'} autoComplete={existing ? 'current-password' : 'new-password'} required minLength={existing ? 1 : 8} maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      {!existing && <label className="ca-field"><span>Confirm password</span><input type={visible ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy} value={confirm} onChange={event => setConfirm(event.target.value)} /></label>}
      <button className="ca-submit" type="submit" disabled={busy}><span className="ca-submit-text">{busy ? 'Finishing setup…' : existing ? 'Sign in and continue' : 'Save password and open portal'}</span><span className="ca-submit-icon"><ArrowUpRight size={16} /></span></button>
      <p className="ca-notice">{existing ? 'Your password stays the same. This invitation adds only the request your PM shared.' : 'Use 8–128 characters. A password does not grant access to internal projects or other clients’ requests.'}</p>
    </form>}
    {error && <p className="ca-error" role="alert">{error}</p>}
    {complete && <a className="ca-submit" href="/#/client">Open my requests</a>}
    {!checking && !complete && <><a className="ca-link" href="/#/client/forgot">Set up or reset your password</a><br /><a className="ca-link" href="/#/client">Return to sign in</a></>}
  </ClientAuthShell>;
}
